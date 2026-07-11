"""
Twitter API 推文采集 + AI 分析命令

用法:
  python manage.py fetch_tweets_v2                          # 采集第一页
  python manage.py fetch_tweets_v2 --pages 3                 # 采集 3 页
  python manage.py fetch_tweets_v2 --dry-run                 # 仅分析不入库
  python manage.py fetch_tweets_v2 --import-only file.json   # 仅导入已有 JSON

通过 twitterapi.io 获取 @TreefinanceCN 推文，使用 AI 分析：
1. 筛选高校行相关活动
2. 过滤无关内容
3. 对含敏感文案的推文进行 AI 润色
4. 入库 TweetReview 表

AI 后端：优先使用 OPENAI_API_KEY（OpenAI 兼容协议），
设置 DEEPSEEK_API_KEY 环境变量可切换为 DeepSeek。

环境变量（.env）:
  TWITTER_API_KEY=new1_785398b2f2404321a2f17c9131d5937a
  OPENAI_API_KEY=          # 必需
  DEEPSEEK_API_KEY=        # 可选，设置后优先用 DeepSeek
"""
import os
import re
import json
import hashlib
import sys
import time
from datetime import datetime

import requests
from django.core.management.base import BaseCommand
from home.agent_runtime import (
    CompatAgentGateway,
    deterministic_dedup,
    deterministic_polish,
    deterministic_tweet_analysis,
)
from home.models import TweetReview, Workspace

# 确保 Windows 下 UTF-8 输出
if sys.platform == 'win32':
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
    sys.stderr.reconfigure(encoding='utf-8', errors='replace')

# ---------------------------------------------------------------------------
# 配置
# ---------------------------------------------------------------------------

TWITTER_API_URL = 'https://api.twitterapi.io/twitter/user/tweet_timeline'
TREEFINANCE_USER_ID = '3476819954'

import requests
from django.core.management.base import BaseCommand

from home.models import TweetReview

# ---------------------------------------------------------------------------
# 配置
# ---------------------------------------------------------------------------

TWITTER_API_URL = 'https://api.twitterapi.io/twitter/user/tweet_timeline'
TREEFINANCE_USER_ID = '3476819954'

# ---------------------------------------------------------------------------
# DeepSeek Prompt — 活动筛选
# ---------------------------------------------------------------------------

FILTER_SYSTEM_PROMPT = (
    '你是一个活动内容审核专家。请分析推文内容，判断是否属于大树财经相关的'
    '"高校行/AI活动/Web3活动"内容。你只返回 JSON，不返回其他内容。'
)

FILTER_PROMPT_TEMPLATE = """请分析以下推文，判断它是否属于大树财经活动回顾相关的内容。

推文内容:
{text}

属于活动回顾的内容包括（满足任一即可）：
### 高校行/校园类
- 高校/大学/学院 线下活动、讲座、论坛、黑客松、工作坊
- 校园行、高校巡回、进校园相关活动
- AI / Web3 高校生态活动
- 学生/校园开发者 相关合作
- 高校教授/学者 采访或合作
- 大学/校园/链协相关的品牌宣传和合作感谢
- 学术界相关的 AI/Web3 动态

### AI 主题活动（重要！）
- AI 相关的比赛/大赛/争霸赛（如 AI 搞钱争霸赛、AI Hackathon）
- AI + Web3 主题活动、峰会、论坛
- AI Agent / AI 应用 / 大模型相关的行业活动
- AI 相关的线上/线下分享、AMA、直播
- 与 AI 技术、产品、生态相关的品牌活动

### Web3 主题活动
- 区块链/Web3 相关的行业峰会、论坛、发布会
- 黑客松/Hackathon 活动
- Web3 品牌合作与重大事件发布
- 行业 AMA、圆桌讨论、直播活动

不属于活动回顾的内容：
- 纯币圈行情/交易/K线分析
- 交易所/Meme币/空投/代币的纯促销推广
- 节日祝福（端午、父亲节等纯节日内容）
- 与大树财经品牌完全无关的转发
- 个人生活/观点分享（无活动属性）

请判断后只返回一个 JSON 对象，不要包含其他文字：
{{
  "is_review_worthy": true/false,
  "summary": "如符合，生成 50 字以内的中文摘要；如不符合，留空字符串",
  "is_sensitive": true/false,
  "sensitive_reason": "如敏感，说明原因（如：币价预测、过度营销、敏感政治隐喻等）；如不敏感，留空字符串"
}}"""

# ---------------------------------------------------------------------------
# DeepSeek Prompt — 敏感文案润色
# ---------------------------------------------------------------------------

POLISH_SYSTEM_PROMPT = (
    '你是一个专业的财经媒体编辑。请对以下推文进行润色，移除可能引起争议或敏感的表达，'
    '保持核心信息不变，使用客观、中立的语气。你只返回润色后的纯文本，不返回其他内容。'
)

POLISH_PROMPT_TEMPLATE = """请对以下推文进行润色，要求：
1. 保留高校活动相关核心信息
2. 移除过度营销/夸大宣传的表达
3. 移除币价预测、投资建议等敏感内容
4. 移除可能涉及政治敏感的隐喻或表达
5. 语气客观、专业、中立

原始推文:
{text}

敏感原因: {reason}

请只返回润色后的纯文本（不要包含 JSON 或其他格式）："""


def _parse_twitter_date(date_str):
    """解析 Twitter 日期字符串"""
    if not date_str:
        return None
    try:
        return datetime.strptime(date_str, '%a %b %d %H:%M:%S %z %Y')
    except ValueError:
        try:
            return datetime.fromisoformat(date_str)
        except (ValueError, TypeError):
            return None


def _extract_media_urls(tweet):
    """从推文中提取所有图片 URL

    优先从 retweeted_tweet.extendedEntities.media 提取，
    其次从顶层 extendedEntities.media 提取。
    """
    # 如果是转推，优先取转推内容的 media
    rt = tweet.get('retweeted_tweet') or {}
    entities = rt.get('extendedEntities') or tweet.get('extendedEntities') or {}
    media_list = entities.get('media', [])
    return [m.get('media_url_https', '') for m in media_list if m.get('media_url_https')]


def _get_tweet_text(tweet):
    """获取推文实际文本内容

    对于转推，优先使用 retweeted_tweet.text（去除 RT @xxx: 前缀）。
    """
    rt = tweet.get('retweeted_tweet')
    if rt and rt.get('text'):
        return rt['text']
    return tweet.get('text', '')


def _extract_space_url(tweet):
    """从推文的 entities.urls 中提取 X Space 链接。

    返回第一个匹配的 Space URL，没有则返回空字符串。
    """
    entities = tweet.get('entities', {})
    urls = entities.get('urls', [])
    for u in urls:
        expanded = u.get('expanded_url', '')
        if '/i/spaces/' in expanded:
            return expanded
    # 也检查转推的 entities
    rt = tweet.get('retweeted_tweet')
    if rt:
        return _extract_space_url(rt)
    return ''


class Command(BaseCommand):
    help = '从 Twitter API 采集 @TreefinanceCN 推文，DeepSeek AI 分析后入库'

    def add_arguments(self, parser):
        parser.add_argument(
            '--pages', type=int, default=1,
            help='采集页数（每页 20 条，默认 1 页）',
        )
        parser.add_argument(
            '--dry-run', action='store_true',
            help='仅分析不入库',
        )
        parser.add_argument(
            '--import-only', type=str, metavar='FILE',
            help='仅导入已有 JSON 文件（不调用 API）',
        )
        parser.add_argument(
            '--api-key', type=str,
            help='Twitter API Key（也可通过 TWITTER_API_KEY 环境变量设置）',
        )
        parser.add_argument(
            '--dedup', action='store_true',
            help='对已有数据进行 AI 去重（内容相似度 > 80%% 视为重复）',
        )

    def handle(self, *args, **options):
        pages = options['pages']
        dry_run = options['dry_run']
        import_file = options['import_only']
        do_dedup = options['dedup']
        twitter_api_key = options.get('api_key') or os.environ.get('TWITTER_API_KEY', '')

        # -------------------------------------------------------------------
        # 统一 Agent gateway：无 Key 或 provider 失败时确定性降级。
        # -------------------------------------------------------------------
        self.agent = CompatAgentGateway()
        self.workspace, _ = Workspace.objects.get_or_create(
            slug='treefinance', defaults={'name': 'TreeFinance'},
        )

        # -------------------------------------------------------------------
        # 去重模式
        # -------------------------------------------------------------------
        if do_dedup:
            self._dedup_existing()
            return

        # -------------------------------------------------------------------
        # 仅导入模式
        # -------------------------------------------------------------------
        if import_file:
            self._import_json_file(import_file, dry_run)
            return

        # -------------------------------------------------------------------
        # 正常采集模式
        # -------------------------------------------------------------------
        if not twitter_api_key:
            self.stderr.write('错误: 未设置 TWITTER_API_KEY 环境变量')
            self.stderr.write('用法: set TWITTER_API_KEY=new1_xxx && python manage.py fetch_tweets_v2')
            return

        # -------------------------------------------------------------------
        # 1. 采集推文
        # -------------------------------------------------------------------
        all_tweets = []
        cursor = None
        for page_num in range(1, pages + 1):
            self.stdout.write(f'📡 正在获取第 {page_num} 页推文...')
            resp = self._fetch_tweets(twitter_api_key, cursor)
            tweets = resp.get('tweets', [])
            all_tweets.extend(tweets)
            self.stdout.write(f'  获取到 {len(tweets)} 条推文')

            if resp.get('has_next_page') and page_num < pages:
                cursor = resp.get('next_cursor')
                time.sleep(1)
            else:
                break

        self.stdout.write(f'共获取 {len(all_tweets)} 条推文，开始 AI 分析...')

        # -------------------------------------------------------------------
        # 2. DeepSeek 分析 + 入库
        # -------------------------------------------------------------------
        saved = skipped = polished = 0

        for i, tweet in enumerate(all_tweets):
            tweet_id = tweet.get('id', '')
            text = _get_tweet_text(tweet)
            twitter_url = tweet.get('twitterUrl', tweet.get('url', ''))
            media_urls = _extract_media_urls(tweet)
            space_url = _extract_space_url(tweet)
            published_at = _parse_twitter_date(tweet.get('createdAt'))

            self.stdout.write(f'  [{i+1}/{len(all_tweets)}] {text[:60]}...')

            # DeepSeek 分析
            analysis = self._deepseek_analyze(text)
            if analysis is None:
                skipped += 1
                continue

            is_worthy = analysis.get('is_review_worthy', False)
            is_sensitive = analysis.get('is_sensitive', False)
            summary = analysis.get('summary', '')
            sensitive_reason = analysis.get('sensitive_reason', '')

            if not is_worthy:
                self.stdout.write(f'    ❌ 非高校行活动，跳过')
                skipped += 1
            else:
                # 敏感文案润色
                text_processed = ''
                if is_sensitive:
                    text_processed = self._deepseek_polish(text, sensitive_reason)
                    if text_processed:
                        polished += 1
                        self.stdout.write(f'    ✨ 已润色敏感文案')

                # 入库
                if dry_run:
                    self.stdout.write(
                        self.style.WARNING(f'    [DRY-RUN] {summary[:60]}')
                    )
                    saved += 1
                else:
                    # 内容去重检查
                    dup = self._check_content_duplicate(text, tweet_id)
                    if dup:
                        self.stdout.write(f'    ⚠️ 内容重复 → 跳过 (已有 tweet_id={dup})')
                        skipped += 1
                        continue

                    _, created = TweetReview.objects.update_or_create(
                        tweet_id=tweet_id,
                        defaults={
                            'workspace': self.workspace,
                            'text': text,
                            'text_processed': text_processed or '',
                            'media_urls': json.dumps(media_urls, ensure_ascii=False),
                            'twitter_url': twitter_url,
                            'space_url': space_url,
                            'summary': summary,
                            'is_review_worthy': True,
                            'is_sensitive': is_sensitive,
                            'published_at': published_at,
                            'raw_data': json.dumps(tweet, ensure_ascii=False),
                        },
                    )
                    if created:
                        saved += 1
                        self.stdout.write(
                            self.style.SUCCESS(f'    ✅ 入库: {summary[:60]}')
                        )
                    else:
                        self.stdout.write(f'    已存在，跳过')

            # 频率控制
            time.sleep(0.5)

        # -------------------------------------------------------------------
        # 3. 输出统计
        # -------------------------------------------------------------------
        self.stdout.write('')
        self.stdout.write(
            self.style.SUCCESS(
                f'✅ 完成 — 入库 {saved} 条，跳过 {skipped} 条'
                + (f'，润色 {polished} 条' if polished else '')
            )
        )

    # =======================================================================
    # Twitter API
    # =======================================================================

    def _fetch_tweets(self, api_key, cursor=None):
        """调用 twitterapi.io 获取推文时间线"""
        params = {'userId': TREEFINANCE_USER_ID}
        if cursor:
            params['cursor'] = cursor

        headers = {'X-API-Key': api_key}

        try:
            resp = requests.get(
                TWITTER_API_URL, params=params, headers=headers, timeout=30
            )
            resp.raise_for_status()
            data = resp.json()

            if data.get('status') != 'success':
                self.stderr.write(f'API 返回错误: {data.get("msg", "未知错误")}')
                return {}

            return data.get('data', {})

        except requests.RequestException as e:
            self.stderr.write(f'Twitter API 请求失败: {e}')
            return {}

    # =======================================================================
    # LLM 分析 & 润色
    # =======================================================================

    def _deepseek_analyze(self, text):
        """调用 LLM 分析推文是否为高校行活动

        使用 fetch_events.py 相同的 LLM 调用模式。
        """
        if not text:
            return None

        prompt = FILTER_PROMPT_TEMPLATE.format(text=text[:2000])

        result, _ = self.agent.generate_json(
            workspace=self.workspace,
            task='classify',
            messages=[
                {'role': 'system', 'content': FILTER_SYSTEM_PROMPT},
                {'role': 'user', 'content': prompt},
            ],
            source_ids=[f'tweet-content:{hashlib.sha256(text.encode()).hexdigest()[:20]}'],
            fallback_value=lambda: deterministic_tweet_analysis(text),
        )
        return result

    def _deepseek_polish(self, text, reason):
        """调用 LLM 润色敏感文案

        使用 fetch_events.py 相同的 LLM 调用模式。
        """
        if not text:
            return ''

        prompt = POLISH_PROMPT_TEMPLATE.format(text=text[:2000], reason=reason)

        result, _ = self.agent.generate_text(
            workspace=self.workspace,
            task='compliance',
            messages=[
                {'role': 'system', 'content': POLISH_SYSTEM_PROMPT},
                {'role': 'user', 'content': prompt},
            ],
            source_ids=[f'tweet-content:{hashlib.sha256(text.encode()).hexdigest()[:20]}'],
            fallback_value=lambda: deterministic_polish(text),
        )
        return result

    # =======================================================================
    # 内容去重
    # =======================================================================

    DEDUP_PROMPT_TEMPLATE = """请比较以下两段推文内容的相似度。

推文 A:
{a_text}

推文 B:
{b_text}

请判断两段推文的核心信息（主题、事件、关键信息）是否高度重合。只返回一个 JSON：
{{"similarity": 数字（0-100）, "is_duplicate": true/false}}

注意：
- 如果是同一活动/事件的推文，只是 @的人或合作社区不同 → 视为重复
- 如果核心主题不同 → 不重复
- 80 分及以上视为重复"""

    def _check_content_duplicate(self, text, exclude_tweet_id):
        """检查新推文是否与已有数据内容重复（相似度 > 80%）"""
        if not text:
            return None

        # 取最近 50 条作为对比池（避免比对太多）
        recent = TweetReview.objects.exclude(
            tweet_id=exclude_tweet_id
        ).order_by('-created_at')[:50]

        for existing in recent:
            # 先用简单规则过滤：少于 30 个共同字符的不太可能重复
            common = set(text) & set(existing.text)
            if len(common) < 30:
                continue

            prompt = self.DEDUP_PROMPT_TEMPLATE.format(
                a_text=text[:1000], b_text=existing.text[:1000],
            )
            result, _ = self.agent.generate_json(
                workspace=existing.workspace,
                task='dedup',
                messages=[
                    {'role': 'system', 'content': '你是一个文本相似度分析器。只返回 JSON。'},
                    {'role': 'user', 'content': prompt},
                ],
                source_ids=[f'tweet:{exclude_tweet_id}', f'tweet:{existing.tweet_id}'],
                fallback_value=lambda: deterministic_dedup(text, existing.text),
            )
            if result.get('is_duplicate') or result.get('similarity', 0) >= 80:
                return existing.tweet_id

            # 频率控制（避免 DeepSeek 限流）
            time.sleep(0.3)

        return None

    def _dedup_existing(self):
        """对数据库已有数据进行去重"""
        all_tweets = list(TweetReview.objects.all().order_by('created_at'))
        total = len(all_tweets)
        if total < 2:
            self.stdout.write(f'数据量不足（{total} 条），无需去重')
            return

        self.stdout.write(f'🔍 开始去重 — 共 {total} 条数据...')

        # 用 DeepSeek 批量比较：分批处理
        to_delete = set()
        compared = 0

        for i in range(total):
            if all_tweets[i].id in to_delete:
                continue
            for j in range(i + 1, total):
                if all_tweets[j].id in to_delete:
                    continue

                a = all_tweets[i]
                b = all_tweets[j]

                # 简单过滤
                common = set(a.text) & set(b.text)
                if len(common) < 30:
                    continue

                compared += 1
                prompt = self.DEDUP_PROMPT_TEMPLATE.format(
                    a_text=a.text[:1000], b_text=b.text[:1000],
                )
                result, _ = self.agent.generate_json(
                    workspace=a.workspace,
                    task='dedup',
                    messages=[
                        {'role': 'system', 'content': '你是一个文本相似度分析器。只返回 JSON。'},
                        {'role': 'user', 'content': prompt},
                    ],
                    source_ids=[f'tweet:{a.tweet_id}', f'tweet:{b.tweet_id}'],
                    fallback_value=lambda: deterministic_dedup(a.text, b.text),
                )
                if result.get('is_duplicate') or result.get('similarity', 0) >= 80:
                    to_delete.add(b.id)
                    self.stdout.write(
                        f'  🗑️ [{a.tweet_id[:12]}...] ≈ [{b.tweet_id[:12]}...] '
                        f'(相似度 {result.get("similarity", "?")}%) → 删除后者'
                    )

                time.sleep(0.3)

        # 执行删除
        if to_delete:
            deleted = TweetReview.objects.filter(id__in=to_delete).delete()
            self.stdout.write('')
            self.stdout.write(
                self.style.SUCCESS(
                    f'✅ 去重完成 — 删除 {deleted[0]} 条重复数据'
                    f'（共比较 {compared} 次，剩余 {total - deleted[0]} 条）'
                )
            )
        else:
            self.stdout.write('')
            self.stdout.write(self.style.SUCCESS('✅ 未发现重复内容'))

    # =======================================================================
    # 导入 JSON 文件
    # =======================================================================

    def _import_json_file(self, filepath, dry_run=False):
        """导入已有的 Twitter API JSON 文件"""
        self.stdout.write(f'[IMPORT] 导入文件: {filepath}')

        with open(filepath, 'r', encoding='utf-8') as f:
            data = json.load(f)

        if data.get('status') != 'success':
            self.stderr.write('JSON 文件格式错误（status != success）')
            return

        tweets = data.get('data', {}).get('tweets', [])
        self.stdout.write(f'共 {len(tweets)} 条推文，开始 AI 分析...')

        saved = skipped = polished = 0

        for i, tweet in enumerate(tweets):
            tweet_id = tweet.get('id', '')
            text = _get_tweet_text(tweet)
            twitter_url = tweet.get('twitterUrl', tweet.get('url', ''))
            media_urls = _extract_media_urls(tweet)
            space_url = _extract_space_url(tweet)
            published_at = _parse_twitter_date(tweet.get('createdAt'))

            self.stdout.write(f'  [{i+1}/{len(tweets)}] {text[:60]}...')

            # DeepSeek 分析
            analysis = self._deepseek_analyze(text)
            if analysis is None:
                skipped += 1
                continue

            is_worthy = analysis.get('is_review_worthy', False)
            is_sensitive = analysis.get('is_sensitive', False)
            summary = analysis.get('summary', '')
            sensitive_reason = analysis.get('sensitive_reason', '')

            if not is_worthy:
                self.stdout.write(f'    ❌ 非高校行活动，跳过')
                skipped += 1
            else:
                # 敏感文案润色
                text_processed = ''
                if is_sensitive:
                    text_processed = self._deepseek_polish(text, sensitive_reason)
                    if text_processed:
                        polished += 1
                        self.stdout.write(f'    ✨ 已润色敏感文案')

                if dry_run:
                    self.stdout.write(
                        self.style.WARNING(f'    [DRY-RUN] {summary[:60]}')
                    )
                    saved += 1
                else:
                    # 内容去重检查
                    dup = self._check_content_duplicate(text, tweet_id)
                    if dup:
                        self.stdout.write(f'    ⚠️ 内容重复 → 跳过 (已有 tweet_id={dup})')
                        skipped += 1
                        continue

                    _, created = TweetReview.objects.update_or_create(
                        tweet_id=tweet_id,
                        defaults={
                            'workspace': self.workspace,
                            'text': text,
                            'text_processed': text_processed or '',
                            'media_urls': json.dumps(media_urls, ensure_ascii=False),
                            'twitter_url': twitter_url,
                            'space_url': space_url,
                            'summary': summary,
                            'is_review_worthy': True,
                            'is_sensitive': is_sensitive,
                            'published_at': published_at,
                            'raw_data': json.dumps(tweet, ensure_ascii=False),
                        },
                    )
                    if created:
                        saved += 1
                        self.stdout.write(
                            self.style.SUCCESS(f'    ✅ 入库: {summary[:60]}')
                        )
                    else:
                        self.stdout.write(f'    已存在，跳过')

            time.sleep(0.5)

        self.stdout.write('')
        self.stdout.write(
            self.style.SUCCESS(
                f'✅ 完成 — 入库 {saved} 条，跳过 {skipped} 条'
                + (f'，润色 {polished} 条' if polished else '')
            )
        )
