"""
从本地 twitterData JSON 文件导入推文数据到数据库

用法:
  python manage.py import_twitter_data                    # 导入所有文件，AI 分类
  python manage.py import_twitter_data --dry-run          # 仅预览，不执行
  python manage.py import_twitter_data --skip-ai          # 跳过 AI，直接入库
  python manage.py import_twitter_data --file twitterData4.json  # 只导入指定文件
"""
import json
import os
import sys
import time
from pathlib import Path

from django.core.management.base import BaseCommand
from home.agent_runtime import CompatAgentGateway, deterministic_tweet_analysis, deterministic_polish
from home.models import TweetReview, Workspace
from home.management.commands.fetch_tweets_v2 import (
    _parse_twitter_date, _extract_media_urls, _get_tweet_text, _extract_space_url,
)

if sys.platform == 'win32':
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
    sys.stderr.reconfigure(encoding='utf-8', errors='replace')

FILTER_SYSTEM = (
    '你是一个活动内容审核专家。请分析推文内容，判断是否属于大树财经相关的'
    '"高校行/AI活动/Web3活动"内容。你只返回 JSON，不返回其他内容。'
)

FILTER_PROMPT = """请分析以下推文，判断它是否属于大树财经活动回顾相关的内容。

推文内容: {text}

属于活动回顾的内容包括（满足任一即可）：
- 高校/大学/学院 线下活动、讲座、论坛、黑客松、工作坊
- 校园行、高校巡回、进校园相关活动
- AI / Web3 高校生态活动
- AI 相关的比赛/大赛/争霸赛
- 区块链/Web3 相关的行业峰会
- 黑客松/Hackathon 活动
- 世界杯相关的体育/活动内容

不属于：纯币圈行情、交易所促销、节日祝福、个人生活分享

请判断后只返回 JSON：{{"is_review_worthy": true/false, "summary": "...", "is_sensitive": true/false, "sensitive_reason": "..."}}"""


class Command(BaseCommand):
    help = '从本地 twitterData JSON 文件导入推文到数据库'

    def add_arguments(self, parser):
        parser.add_argument('--dry-run', action='store_true', help='仅预览不执行')
        parser.add_argument('--skip-ai', action='store_true', help='跳过 AI 分类，直接入库')
        parser.add_argument('--file', type=str, help='只导入指定文件（如 twitterData4.json）')

    def handle(self, *args, **options):
        dry_run = options['dry_run']
        skip_ai = options['skip_ai']
        specific_file = options['file']

        data_dir = Path(__file__).resolve().parent.parent.parent.parent / 'data'

        if specific_file:
            files = [data_dir / specific_file]
        else:
            files = sorted(data_dir.glob('twitterData*.json'))

        if not files:
            self.stdout.write(self.style.WARNING('未找到 twitterData 文件'))
            return

        workspace = Workspace.objects.first()
        if not workspace:
            self.stdout.write(self.style.ERROR('数据库中没有 Workspace，请先初始化'))
            return

        agent = None if skip_ai else CompatAgentGateway()

        total_files = len(files)
        total_tweets = 0
        total_saved = 0
        total_skipped = 0
        total_polished = 0

        for file_path in files:
            self.stdout.write(f'\n{"=" * 60}')
            self.stdout.write(f'📂 处理文件: {file_path.name}')

            raw = json.loads(file_path.read_text(encoding='utf-8'))
            tweets = raw.get('data', {}).get('tweets', [])
            if not tweets:
                # 顶层直接是 status/data 结构还是已经包含 tweets
                tweets = raw.get('tweets', [])
                if not tweets:
                    self.stdout.write(self.style.WARNING('  未找到推文数据，跳过'))
                    continue

            self.stdout.write(f'  共 {len(tweets)} 条推文')
            total_tweets += len(tweets)

            saved = skipped = polished = 0

            for tweet in tweets:
                tweet_id = tweet.get('id', '')
                text = _get_tweet_text(tweet)
                twitter_url = tweet.get('twitterUrl', tweet.get('url', ''))
                media_urls = _extract_media_urls(tweet)
                space_url = _extract_space_url(tweet)
                published_at = _parse_twitter_date(tweet.get('createdAt'))

                # 已存在则跳过
                if TweetReview.objects.filter(workspace=workspace, tweet_id=tweet_id).exists():
                    skipped += 1
                    continue

                text_processed = ''
                is_review_worthy = True
                is_sensitive = False
                summary = ''

                if not skip_ai and agent:
                    try:
                        analysis, _ = agent.generate_json(
                            workspace=workspace,
                            task='classify',
                            messages=[
                                {'role': 'system', 'content': FILTER_SYSTEM},
                                {'role': 'user', 'content': FILTER_PROMPT.format(text=text[:2000])},
                            ],
                            source_ids=[f'tweet:{tweet_id}'],
                            fallback_value=lambda: deterministic_tweet_analysis(text),
                        )
                        is_review_worthy = analysis.get('is_review_worthy', True)
                        is_sensitive = analysis.get('is_sensitive', False)
                        summary = analysis.get('summary', '')[:200]

                        if not is_review_worthy:
                            skipped += 1
                            continue

                        if is_sensitive:
                            text_processed, _ = agent.generate_text(
                                workspace=workspace,
                                task='compliance',
                                messages=[
                                    {'role': 'system', 'content': '你是专业财经编辑。请对推文润色，移除敏感表达，保持核心信息不变。只返回润色后文本。'},
                                    {'role': 'user', 'content': f'请润色以下推文（原因：{analysis.get("sensitive_reason")}）：\n\n{text}'},
                                ],
                                source_ids=[f'tweet:{tweet_id}'],
                                fallback_value=lambda: deterministic_polish(text),
                            )
                            if text_processed:
                                polished += 1
                    except Exception as e:
                        self.stdout.write(self.style.WARNING(f'  ⚠️ AI 分析失败 [{tweet_id}]: {e}，使用原始数据入库'))
                        summary = text[:200]

                if not dry_run:
                    TweetReview.objects.update_or_create(
                        workspace=workspace,
                        tweet_id=tweet_id,
                        defaults={
                            'text': text,
                            'text_processed': text_processed or '',
                            'media_urls': json.dumps(media_urls, ensure_ascii=False),
                            'twitter_url': twitter_url,
                            'space_url': space_url,
                            'summary': summary,
                            'is_review_worthy': is_review_worthy,
                            'is_sensitive': is_sensitive,
                            'published_at': published_at,
                            'raw_data': json.dumps(tweet, ensure_ascii=False),
                        },
                    )
                saved += 1
                time.sleep(0.3)

            self.stdout.write(f'  ✅ 入库: {saved}  |  ⏭ 跳过: {skipped}  |  ✨ 润色: {polished}')
            total_saved += saved
            total_skipped += skipped
            total_polished += polished

        self.stdout.write(f'\n{"=" * 60}')
        summary_line = f'📊 总计 — {total_files} 个文件, {total_tweets} 条推文, 入库 {total_saved}, 跳过 {total_skipped}'
        if dry_run:
            self.stdout.write(self.style.SUCCESS(f'[DRY RUN] {summary_line}'))
        else:
            self.stdout.write(self.style.SUCCESS(summary_line))
