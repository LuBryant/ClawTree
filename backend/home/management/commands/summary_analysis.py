"""
Space 语音总结生成命令

扫描 home_tweetreview 表中 space_url 不为空但 space_summary 为空的记录，
使用 AI 生成结构化总结并回填。

用法:
  python manage.py summary_analysis                    # 最多处理 3 条
  python manage.py summary_analysis --limit 5          # 自定义上限
  python manage.py summary_analysis --dry-run          # 仅预览不执行
  python manage.py summary_analysis --id 3             # 处理指定记录
"""
import json
import os
import sys
import time

from django.core.management.base import BaseCommand
from dotenv import load_dotenv
from home.agent_runtime import CompatAgentGateway, deterministic_space_summary
from home.models import TweetReview

# 确保 Windows 下 UTF-8 输出
if sys.platform == 'win32':
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
    sys.stderr.reconfigure(encoding='utf-8', errors='replace')

# 加载 .env
BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
load_dotenv(os.path.join(BASE_DIR, '.env'))

# ---------------------------------------------------------------------------
# AI Prompt
# ---------------------------------------------------------------------------

SYSTEM_PROMPT = (
    '你是 ClawTree 的语音内容分析专家。请根据提供的 X Space 语音节目信息'
    '和关联推文，生成一份结构化的节目总结。用中文输出，风格专业清晰。'
)

SUMMARY_PROMPT = """请为以下 X Space 语音节目生成一份总结。

=== 关联推文内容 ===
{tweet_text}

=== 推文 AI 摘要 ===
{ai_summary}

=== Space 链接 ===
{space_url}

请生成一份结构化的总结，包含：
1. 🎙️ **节目概述** — 一句话概括这场 Space 的主题和定位
2. 📋 **核心议题** — 列出 2-4 个可能的讨论要点
3. 👥 **参与方** — 提到的主办方、嘉宾或合作方
4. 📌 **关键看点** — 值得关注的内容亮点

使用 Markdown 格式，200-400 字。只返回总结内容，不要其他解释。"""


class Command(BaseCommand):
    help = '为有 Space 链接但无总结的推文生成 AI 语音总结（每次最多 3 条）'

    def add_arguments(self, parser):
        parser.add_argument('--limit', type=int, default=3, help='单次处理上限（默认 3）')
        parser.add_argument('--dry-run', action='store_true', help='仅预览待处理记录，不执行 AI 调用')
        parser.add_argument('--id', type=int, help='仅处理指定 ID 的记录')

    def handle(self, *args, **options):
        limit = options['limit']
        dry_run = options['dry_run']
        target_id = options['id']

        agent = CompatAgentGateway()

        # 查询待处理的记录
        queryset = TweetReview.objects.exclude(space_url='').filter(space_summary='')
        if target_id:
            queryset = queryset.filter(id=target_id)

        total_pending = queryset.count()
        candidates = queryset.order_by('-created_at')[:limit]

        if total_pending == 0:
            self.stdout.write('✅ 所有有 Space 链接的记录都已有总结。')
            return

        self.stdout.write(f'🔍 共 {total_pending} 条待处理，本次处理 {min(limit, total_pending)} 条\n')

        success = 0
        failed = 0

        for i, record in enumerate(candidates):
            self.stdout.write(f'[{i+1}/{min(limit, total_pending)}] ID={record.id} | {record.summary[:50]}...')
            self.stdout.write(f'  Space: {record.space_url}')

            if dry_run:
                self.stdout.write(self.style.WARNING('  [DRY-RUN] 跳过 AI 调用\n'))
                continue

            tweet_text = (record.text_processed or record.text)[:1500]
            ai_summary = record.summary or ''

            prompt = SUMMARY_PROMPT.format(
                tweet_text=tweet_text,
                ai_summary=ai_summary,
                space_url=record.space_url,
            )

            try:
                summary, _ = agent.generate_text(
                    workspace=record.workspace,
                    task='space_summary',
                    messages=[
                        {'role': 'system', 'content': SYSTEM_PROMPT},
                        {'role': 'user', 'content': prompt},
                    ],
                    source_ids=[f'tweet:{record.tweet_id}'],
                    fallback_value=lambda: deterministic_space_summary(tweet_text, ai_summary),
                )
                record.space_summary = summary
                record.save(update_fields=['space_summary'])
                success += 1

                self.stdout.write(self.style.SUCCESS(f'  ✅ 总结生成成功 ({len(summary)} 字)'))
                self.stdout.write(f'  预览: {summary[:100]}...\n')

            except Exception as e:
                failed += 1
                self.stderr.write(f'  ❌ 生成失败: {e}\n')

            # DeepSeek 频率控制
            time.sleep(0.5)

        # 汇总
        self.stdout.write('─' * 50)
        if not dry_run:
            self.stdout.write(
                self.style.SUCCESS(f'✅ 完成 — 成功 {success} 条，失败 {failed} 条')
            )
        self.stdout.write(f'剩余待处理: {total_pending - success} 条')
