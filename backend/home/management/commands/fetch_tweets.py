"""
Twitter 活动回顾采集命令

用法: python manage.py fetch_tweets [--max-results N] [--dry-run]

通过 xAI Responses API 搜索 @TreefinanceCN 推文，LLM 分析后作为活动回顾入库。

数据流: xAI x_search → LLM 分析 → 去重（按 tweet_id） → 入库
"""
import os
import re
import json
import time
from datetime import datetime

import requests
from django.core.management.base import BaseCommand
from openai import OpenAI

from home.models import EventReview

# ---------------------------------------------------------------------------
# xAI 配置
# ---------------------------------------------------------------------------

XAI_RESPONSES_URL = 'https://api.x.ai/v1/responses'

# ---------------------------------------------------------------------------
# LLM Prompt
# ---------------------------------------------------------------------------

ANALYSIS_SYSTEM_PROMPT = (
    '你是一个推特内容分析专家。请分析推文内容，提取活动回顾相关信息。'
    '你只返回 JSON，不返回其他内容。'
)

ANALYSIS_PROMPT_TEMPLATE = """请分析以下来自 @TreefinanceCN 的推文，判断它是否具有"活动回顾"价值。

推文内容:
{content}

活动回顾的价值标准：
- 高校行活动、线下/线上活动的照片、总结、回顾
- 嘉宾演讲要点、圆桌讨论洞见
- 重要合作发布、里程碑事件
- 学生/社区反馈和参与情况
- AI/Web3 相关活动报道

如果值得回顾，请只返回一个 JSON 对象（不要包含其他文字）：
{{
  "is_review_worthy": true,
  "title": "回顾文章标题（15字以内，吸引人）",
  "summary": "AI 生成的摘要（100字以内）",
  "content": "整理后的回顾正文（基于推文内容展开）",
  "published_at": "推文发布时间（ISO 8601 格式，如 2026-07-03T10:30:00Z）"
}}

如果不值得回顾（如普通互动、转发、抽奖），请返回：
{{
  "is_review_worthy": false
}}

只返回 JSON 对象，不要包含其他文字。"""


class Command(BaseCommand):
    help = '从 Twitter @TreefinanceCN 采集活动回顾并入库'

    def add_arguments(self, parser):
        parser.add_argument(
            '--max-results',
            type=int,
            default=10,
            help='单次最大推文处理数（默认 10）',
        )
        parser.add_argument(
            '--dry-run',
            action='store_true',
            help='仅搜索和分析，不入库',
        )

    def handle(self, *args, **options):
        max_results = options['max_results']
        dry_run = options['dry_run']

        # -------------------------------------------------------------------
        # 初始化 xAI 客户端（用于搜索）
        # -------------------------------------------------------------------
        xai_api_key = os.environ.get('XAI_API_KEY')
        if not xai_api_key:
            self.stderr.write('错误: 未设置 XAI_API_KEY 环境变量')
            self.stderr.write('请从 https://x.ai 获取 API Key 并添加到 .env 文件')
            return

        # -------------------------------------------------------------------
        # 初始化 LLM 客户端（用于分析）
        # -------------------------------------------------------------------
        openai_api_key = os.environ.get('OPENAI_API_KEY')
        if not openai_api_key:
            self.stderr.write('错误: 未设置 OPENAI_API_KEY 环境变量')
            return

        llm_client = OpenAI(
            api_key=openai_api_key,
            base_url=os.environ.get('OPENAI_BASE_URL', 'https://api.openai.com/v1'),
        )
        llm_model = os.environ.get('OPENAI_MODEL', 'gpt-4o-mini')

        # -------------------------------------------------------------------
        # 1. xAI x_search 搜索推文
        # -------------------------------------------------------------------
        self.stdout.write('🔍 正在搜索 @TreefinanceCN 推文...')
        tweets = self._x_search(xai_api_key, max_results)

        if not tweets:
            self.stdout.write('未找到相关推文')
            return

        self.stdout.write(f'找到 {len(tweets)} 条推文，开始分析...')

        # -------------------------------------------------------------------
        # 2. LLM 逐条分析
        # -------------------------------------------------------------------
        saved_count = 0
        skipped_count = 0

        for i, tweet in enumerate(tweets):
            self.stdout.write(f'  [{i+1}/{len(tweets)}] {tweet.get("text", "")[:60]}...')

            # LLM 分析
            analysis = self._llm_analyze(llm_client, llm_model, tweet.get('text', ''))
            if analysis is None:
                skipped_count += 1
                continue

            if not analysis.get('is_review_worthy', False):
                skipped_count += 1
                self.stdout.write(f'    非活动回顾，跳过')
                continue

            # 解析时间
            published_at = self._parse_datetime(
                analysis.get('published_at') or tweet.get('created_at')
            )

            # -------------------------------------------------------------------
            # 3. 去重入库
            # -------------------------------------------------------------------
            tweet_id = tweet.get('id', '')
            source_url = f"https://x.com/TreefinanceCN/status/{tweet_id}" if tweet_id else ''

            if dry_run:
                self.stdout.write(
                    self.style.WARNING(
                        f'    [DRY-RUN] {analysis["title"]}'
                    )
                )
                saved_count += 1
                continue

            _, created = EventReview.objects.update_or_create(
                tweet_id=tweet_id,
                defaults={
                    'title': analysis.get('title', tweet.get('text', '')[:60])[:500],
                    'content': analysis.get('content', tweet.get('text', '')),
                    'summary': analysis.get('summary', '')[:500],
                    'source_type': 'twitter',
                    'source_url': source_url,
                    'published_at': published_at,
                },
            )

            if created:
                saved_count += 1
                self.stdout.write(
                    self.style.SUCCESS(f'    新增: {analysis["title"]}')
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
                f'✅ 完成 — 入库 {saved_count} 篇，跳过 {skipped_count} 篇'
            )
        )

    # =======================================================================
    # xAI x_search
    # =======================================================================

    def _x_search(self, api_key, max_results):
        """调用 xAI Responses API 搜索 @TreefinanceCN 推文"""
        body = {
            'model': 'grok-4-1-fast-non-reasoning',
            'input': (
                'Search for recent posts from @TreefinanceCN about event reviews, '
                'university tours, AI/Web3 activities, hackathons, event photos, '
                'and community meetups. Return the tweet text, tweet id, and '
                'created_at timestamp for each result.'
            ),
            'tools': [{
                'type': 'x_search',
                'allowed_x_handles': ['TreefinanceCN'],
            }],
            'max_turns': 1,
        }

        headers = {
            'Authorization': f'Bearer {api_key}',
            'Content-Type': 'application/json',
        }

        try:
            resp = requests.post(
                XAI_RESPONSES_URL, json=body, headers=headers, timeout=120
            )
            resp.raise_for_status()
            data = resp.json()

            # 从响应中提取文本输出
            output_text = self._extract_output_text(data)
            if not output_text:
                return []

            # 解析推文列表
            return self._parse_tweets_from_text(output_text)

        except requests.RequestException as e:
            self.stderr.write(f'xAI API 请求失败: {e}')
            return []

    @staticmethod
    def _extract_output_text(data):
        """从 xAI Responses API 返回中提取文本"""
        output = data.get('output', [])
        text_parts = []
        for item in output:
            if item.get('type') == 'message':
                for content_item in item.get('content', []):
                    if content_item.get('type') == 'output_text':
                        text_parts.append(content_item.get('text', ''))
        return '\n'.join(text_parts)

    @staticmethod
    def _parse_tweets_from_text(text):
        """从 xAI 返回的自然语言文本中解析推文列表

        x_search 返回的是自然语言描述，尝试从中提取结构化推文信息。
        同时尝试匹配推文 ID 和文本内容。
        """
        tweets = []

        # 尝试匹配推文 URL 模式
        tweet_url_pattern = re.compile(
            r'(?:https?://)?(?:x\.com|twitter\.com)/TreefinanceCN/status/(\d+)'
        )
        tweet_ids = tweet_url_pattern.findall(text)

        if tweet_ids:
            # 将文本按推文引用分割
            for tid in tweet_ids[:]:
                tweets.append({
                    'id': tid,
                    'text': text,  # 整段文本作为上下文
                    'created_at': None,
                })
        else:
            # 无法解析出具体推文时，把整段文本作为一条记录
            tweets.append({
                'id': '',
                'text': text,
                'created_at': None,
            })

        return tweets

    # =======================================================================
    # LLM 分析
    # =======================================================================

    def _llm_analyze(self, client, model, tweet_text):
        """调用 LLM 分析推文是否值得回顾"""
        if not tweet_text:
            return None

        prompt = ANALYSIS_PROMPT_TEMPLATE.format(content=tweet_text)

        for attempt in range(3):
            try:
                message = client.chat.completions.create(
                    model=model,
                    max_tokens=800,
                    temperature=0.3,
                    messages=[
                        {'role': 'system', 'content': ANALYSIS_SYSTEM_PROMPT},
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
    def _parse_datetime(value):
        """解析 ISO 8601 日期时间字符串"""
        if not value:
            return None

        for fmt in [
            '%Y-%m-%dT%H:%M:%SZ',
            '%Y-%m-%dT%H:%M:%S%z',
            '%Y-%m-%dT%H:%M:%S',
            '%Y-%m-%d %H:%M:%S',
            '%Y-%m-%d',
        ]:
            try:
                return datetime.strptime(value, fmt)
            except ValueError:
                continue

        # ISO 8601 with timezone offset (e.g. 2026-07-03T10:30:00+08:00)
        try:
            return datetime.fromisoformat(value)
        except (ValueError, TypeError):
            return None
