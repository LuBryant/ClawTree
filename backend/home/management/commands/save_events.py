"""
OpenClaw University-Event-Collector — 活动保存命令

接受 OpenClaw skill 输出的标准 JSON 格式，自动分类、去重、入库。

用法:
  python manage.py save_events events.json
  python manage.py save_events events.json --dry-run
"""
import json
import sys
from datetime import date, datetime

from django.core.management.base import BaseCommand

from home.models import UniversityEvent

if sys.platform == 'win32':
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')


def _parse_date(value):
    if not value:
        return None
    for fmt in ['%Y-%m-%d', '%Y/%m/%d', '%Y-%m']:
        try:
            return datetime.strptime(value, fmt).date()
        except ValueError:
            continue
    try:
        return datetime.strptime(value + '-01', '%Y-%m-%d').date()
    except ValueError:
        return None


def _infer_category(title, description):
    text = f'{title} {description}'.lower()
    has_ai = any(kw in text for kw in ['ai', '人工智能', '机器学习', '大模型', '深度学习'])
    has_web3 = any(kw in text for kw in ['web3', '区块链', 'defi', '智能合约', 'nft', 'dao', '加密'])
    if has_ai and has_web3:
        return 'AI+Web3'
    if has_web3:
        return 'Web3'
    return 'AI'


VALID_TYPES = ['黑客松', '分享会', '讲座', '竞赛', '研讨会', '论坛', '工作坊', '夏令营', '其他']


class Command(BaseCommand):
    help = '导入 OpenClaw University-Event-Collector 输出的 JSON'

    def add_arguments(self, parser):
        parser.add_argument('json_file', type=str, help='OpenClaw 输出的 JSON 文件路径')
        parser.add_argument('--dry-run', action='store_true', help='仅预览不入库')

    def handle(self, *args, **options):
        filepath = options['json_file']
        dry_run = options['dry_run']

        with open(filepath, 'r', encoding='utf-8') as f:
            data = json.load(f)

        events = data.get('events', [])
        meta = data.get('meta', {})

        self.stdout.write(f'[OpenClaw] {filepath}')
        self.stdout.write(f'  query_time: {meta.get("query_time", "N/A")}')
        self.stdout.write(f'  events: {len(events)}')

        saved = skipped = 0

        for i, ev in enumerate(events):
            # 兼容两种输入格式
            # 格式 A（OpenClaw 旧版）: school, activity_name, date, type, contact:{official_email,...}, confidence
            # 格式 B（OpenClaw 新版）: university, title, event_date, event_type, contact_email, score
            contact = ev.get('contact', {})
            title = (ev.get('title') or ev.get('activity_name') or '')[:500]
            university = (ev.get('university') or ev.get('school') or '')[:200]
            desc = (ev.get('description') or '')[:1000]
            source_url = ev.get('source_url', '')
            ev_type = ev.get('event_type') or ev.get('type') or '其他'
            if ev_type not in VALID_TYPES:
                ev_type = '其他'
            event_date_raw = ev.get('event_date') or ev.get('date') or None
            contact_email = (ev.get('contact_email') or contact.get('official_email') or '')[:200]
            contact_ai_email = (ev.get('contact_ai_email') or contact.get('ai_dept_email') or '')[:200]
            contact_phone = (ev.get('contact_phone') or contact.get('phone') or '')[:50]
            contact_wechat = (ev.get('contact_wechat') or contact.get('wechat') or '')[:100]
            contact_qq = (ev.get('contact_qq') or contact.get('qq') or '')[:50]
            location = (ev.get('location') or '')[:300]
            # score: 新版直接是整数，旧版 confidence 是 0-1 浮点
            raw_score = ev.get('score') or ev.get('confidence')
            if raw_score is not None:
                if isinstance(raw_score, (int, float)) and raw_score <= 1:
                    score = int(raw_score * 100)
                else:
                    score = int(min(raw_score, 100))
            else:
                score = 0

            self.stdout.write(f'  [{i+1}/{len(events)}] {title[:60]}')

            if not source_url:
                self.stderr.write(f'    无 source_url，跳过')
                skipped += 1
                continue

            if dry_run:
                self.stdout.write(self.style.WARNING(f'    [DRY-RUN] [{_infer_category(title, desc)}] {title[:60]}'))
                saved += 1
                continue

            _, created = UniversityEvent.objects.update_or_create(
                source_url=source_url,
                defaults={
                    'title': title,
                    'university': university,
                    'event_date': _parse_date(event_date_raw),
                    'description': desc,
                    'location': location,
                    'source_name': 'openclaw',
                    'contact_email': contact_email,
                    'contact_ai_email': contact_ai_email,
                    'contact_phone': contact_phone,
                    'contact_wechat': contact_wechat,
                    'contact_qq': contact_qq,
                    'category': _infer_category(title, desc),
                    'event_type': ev_type,
                    'score': score,
                    'raw_data': json.dumps(ev, ensure_ascii=False),
                },
            )

            if created:
                saved += 1
                self.stdout.write(self.style.SUCCESS(f'    OK [{_infer_category(title, desc)}] {title[:60]}'))
            else:
                skipped += 1
                self.stdout.write(f'    SKIP (dup)')

        self.stdout.write('')
        self.stdout.write(self.style.SUCCESS(f'DONE — saved {saved}, skipped {skipped}'))
