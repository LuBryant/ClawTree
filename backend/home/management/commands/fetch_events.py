"""
高校 AI/Web3 活动采集命令

用法: python manage.py fetch_events [--max-results N] [--dry-run]

多渠道自动检索高校 AI/Web3 活动，LLM 结构化提取后存入数据库。
参考 fetch_topic.py + fetch_news.py 模式。

数据流: 搜索 → 详情抓取 → LLM 提取 → 邮箱正则 → 去重入库
"""
import os
import re
import json
import time
from datetime import date

import requests
from bs4 import BeautifulSoup
from django.core.management.base import BaseCommand
from openai import OpenAI

from home.models import UniversityEvent

# ---------------------------------------------------------------------------
# 搜索配置
# ---------------------------------------------------------------------------

# 搜索关键词模板
SEARCH_KEYWORDS = [
    '高校 AI 讲座 2026',
    '高校 人工智能 论坛 2026',
    '高校 区块链 Web3 活动',
    '大学 黑客松 AI',
    '大学 Web3 峰会',
    '高校 AI 研讨会',
    '人工智能 学院 讲座',
    '区块链 高校 论坛',
    'Web3 校园 活动',
    'AI Hackathon 高校',
]

# 重点高校列表
UNIVERSITIES = [
    '清华大学', '北京大学', '浙江大学', '上海交通大学',
    '复旦大学', '南京大学', '中国科学技术大学', '华中科技大学',
    '武汉大学', '中山大学', '西安交通大学', '哈尔滨工业大学',
    '同济大学', '北京航空航天大学', '中国人民大学', '南开大学',
    '天津大学', '东南大学', '厦门大学', '四川大学',
    '电子科技大学', '北京邮电大学', '西安电子科技大学',
]

# 学术学会官网
ACADEMIC_SOURCES = [
    {
        'name': 'CCF（中国计算机学会）',
        'url': 'https://www.ccf.org.cn/Activities/',
        'list_selector': 'div.activities-list a',
        'encoding': 'utf-8',
    },
]

# 请求头
HEADERS = {
    'User-Agent': (
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) '
        'AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'
    ),
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
}

# 邮箱正则
EMAIL_PATTERN = re.compile(
    r'[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.(?:edu|org|com|net|cn)',
    re.IGNORECASE,
)

# ---------------------------------------------------------------------------
# LLM Prompt
# ---------------------------------------------------------------------------

EXTRACTION_SYSTEM_PROMPT = (
    '你是一个高校活动信息提取器。从给定的网页内容中提取 AI/Web3 相关活动信息。'
    '你只返回 JSON，不返回其他内容。'
)

EXTRACTION_PROMPT_TEMPLATE = """请从以下网页内容中提取高校 AI/Web3 活动信息。

网页来源: {source_name}
网页 URL: {url}

网页内容:
{content}

请只返回一个 JSON 对象（不要包含其他文字）:
{{
  "is_ai_web3_event": true,
  "title": "活动标题",
  "university": "主办高校名称",
  "event_date": "2026-07-15",
  "event_end_date": "2026-07-16",
  "location": "活动地点（线上/线下/混合）",
  "description": "中文简要描述（50字以内）",
  "category": "AI",
  "event_type": "论坛",
  "registration_url": "报名链接（没有则为空字符串）",
  "score": 8,
  "contact_email": "联系邮箱（没有则为空字符串）",
  "contact_phone": "联系电话（没有则为空字符串）"
}}

字段说明:
- is_ai_web3_event: 该内容是否真的涉及 AI/Web3 活动（不是则 false）
- category: 只能是 "AI" / "Web3" / "AI+Web3"
- event_type: 只能是 "讲座" / "黑客松" / "论坛" / "工作坊" / "其他"
- score: 1-10 分，评估活动的匹配度和信息完整度
- 如果字段无法从内容中提取，日期类填 null，字符串类填空字符串"""


class Command(BaseCommand):
    help = '多渠道检索高校 AI/Web3 活动并入库'

    def add_arguments(self, parser):
        parser.add_argument(
            '--max-results',
            type=int,
            default=10,
            help='单次最大搜索结果数（默认 10）',
        )
        parser.add_argument(
            '--dry-run',
            action='store_true',
            help='仅搜索和提取，不入库',
        )
        parser.add_argument(
            '--keywords',
            type=str,
            help='自定义搜索关键词（逗号分隔），覆盖默认关键词',
        )

    def handle(self, *args, **options):
        max_results = options['max_results']
        dry_run = options['dry_run']

        # 关键词
        if options.get('keywords'):
            keywords = [k.strip() for k in options['keywords'].split(',') if k.strip()]
        else:
            keywords = SEARCH_KEYWORDS[:]
            env_keywords = os.environ.get('UNIVERSITY_SEARCH_KEYWORDS', '')
            if env_keywords:
                keywords.extend(
                    k.strip() for k in env_keywords.split(',') if k.strip()
                )

        self.stdout.write(f'搜索关键词: {", ".join(keywords[:5])}{"..." if len(keywords) > 5 else ""}')

        # -------------------------------------------------------------------
        # 初始化 LLM 客户端
        # -------------------------------------------------------------------
        api_key = os.environ.get('OPENAI_API_KEY')
        if not api_key:
            self.stderr.write('错误: 未设置 OPENAI_API_KEY 环境变量')
            return

        llm_client = OpenAI(
            api_key=api_key,
            base_url=os.environ.get('OPENAI_BASE_URL', 'https://api.openai.com/v1'),
        )
        llm_model = os.environ.get('OPENAI_MODEL', 'gpt-4o-mini')

        # -------------------------------------------------------------------
        # 1. 多渠道搜索
        # -------------------------------------------------------------------
        all_items = []

        # Layer 1 — Bing 搜索引擎
        bing_results = self._search_bing(keywords, UNIVERSITIES, max_results)
        all_items.extend(bing_results)
        self.stdout.write(f'搜索引擎: {len(bing_results)} 条结果')

        # Layer 2 — 学术学会官网
        academic_results = self._search_academic()
        all_items.extend(academic_results)
        self.stdout.write(f'学术学会: {len(academic_results)} 条结果')

        # Layer 3 — 活动平台
        platform_results = self._search_platforms(keywords, max_results)
        all_items.extend(platform_results)
        self.stdout.write(f'活动平台: {len(platform_results)} 条结果')

        # 去重（按 URL）
        seen_urls = set()
        unique_items = []
        for item in all_items:
            if item['url'] not in seen_urls:
                seen_urls.add(item['url'])
                unique_items.append(item)

        self.stdout.write(f'去重后共 {len(unique_items)} 条待处理')

        # -------------------------------------------------------------------
        # 2. 逐条抓取详情 + LLM 提取
        # -------------------------------------------------------------------
        saved_count = 0
        skipped_count = 0

        for i, item in enumerate(unique_items):
            self.stdout.write(f'  [{i+1}/{len(unique_items)}] {item["title"][:60]}...')

            # 抓取详情页
            html = self._fetch_detail(item['url'])
            if not html:
                skipped_count += 1
                self.stderr.write(f'    详情页抓取失败')
                continue

            # 提取纯文本（前 4000 字符）
            text = self._html_to_text(html)

            # LLM 结构化提取
            extracted = self._llm_extract(llm_client, llm_model, item, text)
            if extracted is None:
                skipped_count += 1
                continue

            if not extracted.get('is_ai_web3_event', False):
                skipped_count += 1
                self.stdout.write(f'    非 AI/Web3 活动，跳过')
                continue

            # 正则补充邮箱
            if not extracted.get('contact_email'):
                emails = EMAIL_PATTERN.findall(html)
                if emails:
                    extracted['contact_email'] = emails[0]

            # 评分过滤
            score = extracted.get('score', 0)
            if score < 3:
                skipped_count += 1
                self.stdout.write(f'    评分 {score} < 3，跳过')
                continue

            # -------------------------------------------------------------------
            # 3. 去重入库
            # -------------------------------------------------------------------
            if dry_run:
                self.stdout.write(
                    self.style.WARNING(
                        f'    [DRY-RUN] [{extracted["category"]}] {extracted["title"]}'
                        f' — {extracted["university"]}'
                    )
                )
                saved_count += 1
                continue

            _, created = UniversityEvent.objects.update_or_create(
                source_url=item['url'],
                defaults={
                    'title': extracted.get('title', item['title'])[:500],
                    'university': extracted.get('university', '')[:200],
                    'event_date': self._parse_date(extracted.get('event_date')),
                    'event_end_date': self._parse_date(extracted.get('event_end_date')),
                    'location': extracted.get('location', '')[:300],
                    'description': extracted.get('description', '')[:1000],
                    'source_name': item['source_name'],
                    'contact_email': extracted.get('contact_email', '')[:200],
                    'contact_phone': extracted.get('contact_phone', '')[:50],
                    'category': self._validate_category(extracted.get('category', 'AI')),
                    'event_type': self._validate_event_type(extracted.get('event_type', '其他')),
                    'registration_url': extracted.get('registration_url', '')[:500],
                    'score': min(int(score), 10),
                    'is_contacted': False,
                    'raw_data': json.dumps(extracted, ensure_ascii=False),
                },
            )

            if created:
                saved_count += 1
                self.stdout.write(
                    self.style.SUCCESS(
                        f'    新增 [{extracted["category"]}] {extracted["title"]}'
                        f' — {extracted["university"]}'
                        f' (评分: {score})'
                    )
                )
            else:
                self.stdout.write(f'    已存在，跳过')

            # 频率控制
            time.sleep(0.5)

        # -------------------------------------------------------------------
        # 4. 输出统计
        # -------------------------------------------------------------------
        self.stdout.write('')
        self.stdout.write(
            self.style.SUCCESS(
                f'完成！入库 {saved_count} 条，跳过 {skipped_count} 条，'
                f'共处理 {len(unique_items)} 条'
            )
        )

    # =======================================================================
    # 搜索方法
    # =======================================================================

    def _search_bing(self, keywords, universities, max_results):
        """通过 Bing 搜索高校 AI/Web3 活动"""
        results = []
        per_keyword = max(1, max_results // len(keywords)) if keywords else 5

        for keyword in keywords[:6]:  # 限制关键词数量避免请求过多
            # 对部分关键词追加高校名
            queries = [keyword]
            for uni in universities[:3]:
                queries.append(f'{uni} {keyword}')

            for query in queries[:4]:
                try:
                    items = self._bing_search_single(query, per_keyword)
                    results.extend(items)
                except Exception as e:
                    self.stderr.write(f'    搜索失败 "{query}": {e}')

                time.sleep(1)  # 频率控制

        return results

    def _bing_search_single(self, query, max_results):
        """单次 Bing 搜索"""
        url = 'https://www.bing.com/search'
        params = {'q': query, 'count': max_results, 'setlang': 'zh-Hans'}

        try:
            resp = requests.get(url, params=params, headers=HEADERS, timeout=30)
            resp.raise_for_status()
            soup = BeautifulSoup(resp.text, 'lxml')

            results = []
            for item in soup.select('li.b_algo'):
                title_el = item.select_one('h2 a')
                if not title_el:
                    continue

                title = title_el.get_text(strip=True)
                href = title_el.get('href', '')
                desc_el = item.select_one('.b_caption p')
                desc = desc_el.get_text(strip=True) if desc_el else ''

                if not href or not title:
                    continue

                # 简单过滤：标题或摘要中包含 AI/Web3/高校关键词
                text_lower = (title + desc).lower()
                relevant_keywords = [
                    'ai', '人工智能', 'web3', '区块链', 'blockchain',
                    '讲座', '论坛', '黑客松', 'hackathon', '大学', '高校',
                    '学院', '研讨会', 'workshop',
                ]
                if not any(kw in text_lower for kw in relevant_keywords):
                    continue

                results.append({
                    'title': title,
                    'url': href,
                    'description': desc,
                    'source_name': 'Bing搜索',
                })

            return results[:max_results]

        except requests.RequestException as e:
            raise e

    def _search_academic(self):
        """从学术学会官网检索活动（CCF 等）"""
        results = []
        for src in ACADEMIC_SOURCES:
            try:
                resp = requests.get(src['url'], headers=HEADERS, timeout=30)
                resp.raise_for_status()
                # 尝试检测编码
                resp.encoding = resp.apparent_encoding or src.get('encoding', 'utf-8')
                soup = BeautifulSoup(resp.text, 'lxml')

                for link in soup.select(src['list_selector'])[:10]:
                    title = link.get_text(strip=True)
                    href = link.get('href', '')
                    if not title or not href:
                        continue

                    # 补全相对 URL
                    if href.startswith('/'):
                        from urllib.parse import urljoin
                        href = urljoin(src['url'], href)

                    results.append({
                        'title': title,
                        'url': href,
                        'description': '',
                        'source_name': src['name'],
                    })
            except Exception as e:
                self.stderr.write(f'    {src["name"]} 检索失败: {e}')

        return results

    def _search_platforms(self, keywords, max_results):
        """从活动平台搜索（Luma / 活动行）"""
        results = []

        # 活动行
        try:
            query = '高校 AI Web3'
            url = 'https://www.huodongxing.com/search'
            params = {'q': query, 'city': '全国'}
            resp = requests.get(
                url, params=params, headers=HEADERS, timeout=30
            )
            resp.raise_for_status()
            soup = BeautifulSoup(resp.text, 'lxml')

            for item in soup.select('.search-item, .event-item, div[class*="event"]')[:5]:
                link = item.select_one('a[href*="event"]')
                if not link:
                    continue
                title = link.get_text(strip=True)
                href = link.get('href', '')
                if not title or not href:
                    continue
                if not href.startswith('http'):
                    href = f'https://www.huodongxing.com{href}'

                results.append({
                    'title': title,
                    'url': href,
                    'description': '',
                    'source_name': '活动行',
                })
        except Exception as e:
            self.stderr.write(f'    活动行搜索失败: {e}')

        return results

    # =======================================================================
    # 详情抓取 & 提取
    # =======================================================================

    def _fetch_detail(self, url):
        """抓取详情页 HTML"""
        try:
            resp = requests.get(url, headers=HEADERS, timeout=30)
            resp.raise_for_status()
            # 尝试检测编码
            if resp.encoding and resp.encoding.lower() != 'utf-8':
                try:
                    resp.encoding = resp.apparent_encoding or 'utf-8'
                except Exception:
                    pass
            return resp.text
        except requests.RequestException as e:
            self.stderr.write(f'      请求失败: {e}')
            return ''
        except Exception as e:
            self.stderr.write(f'      抓取异常: {e}')
            return ''

    def _html_to_text(self, html):
        """HTML 转纯文本（截取前 4000 字符供 LLM 提取）"""
        try:
            soup = BeautifulSoup(html, 'lxml')
            # 移除 script / style
            for tag in soup(['script', 'style', 'nav', 'footer', 'header']):
                tag.decompose()
            text = soup.get_text(separator='\n', strip=True)
            # 压缩空白行
            lines = [line.strip() for line in text.split('\n') if line.strip()]
            return '\n'.join(lines)[:4000]
        except Exception:
            return html[:4000]

    def _llm_extract(self, client, model, item, text):
        """调用 LLM 结构化提取活动信息"""
        if not text:
            return None

        prompt = EXTRACTION_PROMPT_TEMPLATE.format(
            source_name=item['source_name'],
            url=item['url'],
            content=text,
        )

        for attempt in range(3):
            try:
                message = client.chat.completions.create(
                    model=model,
                    max_tokens=500,
                    temperature=0.3,
                    messages=[
                        {'role': 'system', 'content': EXTRACTION_SYSTEM_PROMPT},
                        {'role': 'user', 'content': prompt},
                    ],
                )
                response_text = message.choices[0].message.content.strip()

                # 清理 markdown 包裹
                if '```' in response_text:
                    response_text = response_text.split('```')[1]
                    if response_text.startswith('json'):
                        response_text = response_text[4:]
                    response_text = response_text.strip()

                return json.loads(response_text)

            except json.JSONDecodeError as e:
                if attempt < 2:
                    continue
                self.stderr.write(f'    JSON 解析失败: {e}')
                return None
            except Exception as e:
                if '429' in str(e) and attempt < 2:
                    time.sleep(3)
                    continue
                self.stderr.write(f'    LLM 调用失败: {e}')
                return None

    # =======================================================================
    # 辅助方法
    # =======================================================================

    @staticmethod
    def _parse_date(value):
        """解析日期字符串，支持多种格式"""
        if not value:
            return None
        if isinstance(value, date):
            return value

        for fmt in ['%Y-%m-%d', '%Y/%m/%d', '%Y年%m月%d日', '%Y.%m.%d']:
            try:
                from datetime import datetime
                return datetime.strptime(str(value)[:10], fmt).date()
            except ValueError:
                continue

        # 尝试 isoformat
        try:
            from datetime import datetime
            return datetime.fromisoformat(str(value)[:10]).date()
        except (ValueError, TypeError):
            return None

    @staticmethod
    def _validate_category(value):
        """确保分类在有效选项中"""
        valid = {'AI', 'Web3', 'AI+Web3'}
        return value if value in valid else 'AI'

    @staticmethod
    def _validate_event_type(value):
        """确保活动类型在有效选项中"""
        valid = {'讲座', '黑客松', '论坛', '工作坊', '其他'}
        return value if value in valid else '其他'
