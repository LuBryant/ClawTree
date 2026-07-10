"""
回填已有 TweetReview 记录的 space_url。

从 raw_data 中提取 X Space 链接，填充 space_url 字段。

用法:
  python manage.py backfill_space_url
  python manage.py backfill_space_url --dry-run
"""
import json
import sys

from django.core.management.base import BaseCommand
from home.models import TweetReview

# 确保 Windows 下 UTF-8 输出
if sys.platform == 'win32':
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
    sys.stderr.reconfigure(encoding='utf-8', errors='replace')


def _extract_space_url_from_tweet(tweet):
    """从推文的 entities.urls 中提取 X Space 链接。"""
    entities = tweet.get('entities', {})
    urls = entities.get('urls', [])
    for u in urls:
        expanded = u.get('expanded_url', '')
        if '/i/spaces/' in expanded:
            return expanded
    # 也检查转推的 entities
    rt = tweet.get('retweeted_tweet')
    if rt:
        return _extract_space_url_from_tweet(rt)
    return ''


class Command(BaseCommand):
    help = '回填已有 TweetReview 记录的 space_url'

    def add_arguments(self, parser):
        parser.add_argument('--dry-run', action='store_true', help='仅预览，不写入数据库')

    def handle(self, *args, **options):
        dry_run = options['dry_run']
        records = TweetReview.objects.all().order_by('id')
        total = records.count()
        updated = 0
        skipped = 0

        self.stdout.write(f'🔍 扫描 {total} 条 TweetReview 记录...')

        for r in records:
            if r.space_url:
                skipped += 1
                continue

            try:
                raw = json.loads(r.raw_data) if r.raw_data else {}
            except (json.JSONDecodeError, TypeError):
                skipped += 1
                continue

            space_url = _extract_space_url_from_tweet(raw)
            if space_url:
                if dry_run:
                    self.stdout.write(f'  🎙️ [{r.id}] {r.summary[:50]}... → {space_url}')
                else:
                    r.space_url = space_url
                    r.save(update_fields=['space_url'])
                updated += 1
            else:
                skipped += 1

        self.stdout.write('')
        if dry_run:
            self.stdout.write(self.style.WARNING(f'[DRY-RUN] 发现 {updated} 条有 Space 链接的记录'))
        else:
            self.stdout.write(
                self.style.SUCCESS(f'✅ 完成 — 更新 {updated} 条，跳过 {skipped} 条')
            )
