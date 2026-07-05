"""
ClawTree Workspace Content Relay — deterministic fixture/X adapter.

This command turns the offline golden content set into the same auditable
pipeline used by a live X connector:

SourceConnector -> IngestionRun -> ContentItem -> EditorialReview

It intentionally works without network access or API keys, so the hackathon
demo can prove the Content Relay loop even in flight mode. Re-running the same
fixture is safe: existing content is counted as duplicate and no second
ContentItem/EditorialReview is created.

Usage:
  python manage.py run_content_relay
  python manage.py run_content_relay --dry-run
  python manage.py run_content_relay --fixture-reviewed
"""
import hashlib
import json
import re
import time
from pathlib import Path

from django.core.management.base import BaseCommand, CommandError
from django.db import transaction
from django.utils import timezone
from django.utils.dateparse import parse_datetime

from home.models import ContentItem, EditorialReview, IngestionRun, SourceConnector, Workspace


TAXONOMY = {
    'campus': '高校/校园合作信号',
    'ai': 'AI/大模型/数据智能',
    'web3': 'Web3/链上/数字资产基础设施',
    'recap': '活动回顾/复盘',
    'cooperation': '合作/伙伴/资源联动',
    'sports': '公共赛事或体育热点',
    'finance-literacy': '财经素养教育',
    'irrelevant': '与主线无关',
}

RISK_LABELS = {
    'low': [],
    'medium': ['editorial_context_required'],
    'high': ['human_review_required', 'no_betting', 'no_investment_advice', 'no_outcome_guarantee'],
}


def _repo_root():
    return Path(__file__).resolve().parents[4]


def _parse_dt(value):
    if not value:
        return None
    parsed = parse_datetime(value)
    if not parsed:
        return None
    if timezone.is_naive(parsed):
        return timezone.make_aware(parsed, timezone=timezone.utc)
    return parsed


def _external_id(source_url, fallback):
    match = re.search(r'/status/(\d+)', source_url or '')
    return match.group(1) if match else fallback


def _normalize(text):
    return re.sub(r'\s+', ' ', (text or '').strip()).lower()


def _content_hash(source_url, title):
    stable = f'{source_url}\n{_normalize(title)}'
    return hashlib.sha256(stable.encode('utf-8')).hexdigest()


def _cluster_key(item):
    expected = item.get('expected', {})
    duplicate_of = expected.get('duplicateCandidateOf')
    if duplicate_of:
        return f'cluster:{duplicate_of}'
    labels = expected.get('labels') or ['uncategorized']
    return 'cluster:' + ':'.join(labels[:3])


def _classification(item):
    labels = item.get('expected', {}).get('labels', [])
    return {
        'taxonomyVersion': '2026-07-04.content-relay-v1',
        'labels': labels,
        'axes': {
            'campus': 'campus' in labels,
            'ai': 'ai' in labels,
            'web3': 'web3' in labels,
            'editorialValue': item.get('expected', {}).get('action', 'needs_editor_review'),
        },
        'reason': 'Deterministic golden fixture classification; external source text is treated as untrusted data.',
    }


def _safe_summary(item):
    title = item.get('title', '未命名内容')
    risk = item.get('expected', {}).get('risk', 'medium')
    if risk == 'high':
        return f'{title}：仅允许作为财经素养或媒体观察素材，禁止博彩、荐股、收益承诺和赛果保证。'
    if risk == 'medium':
        return f'{title}：可作为合作或内容线索，发布前需编辑确认语境、授权和不承诺边界。'
    return f'{title}：公开来源可追溯，适合进入高校老师可访问的内容回顾。'


def _diff_summary(item):
    risk = item.get('expected', {}).get('risk', 'medium')
    if risk == 'high':
        return '保留公开事实；移除可能被理解为博彩、荐股、收益承诺或结果保证的表达。'
    if risk == 'medium':
        return '保留事实和来源；压缩营销性表达，补充人工审核与授权边界。'
    return '保留事实和来源；改写为老师侧可快速理解的摘要。'


class Command(BaseCommand):
    help = 'Run one ClawTree workspace Content Relay from a deterministic fixture without external network calls.'

    def add_arguments(self, parser):
        parser.add_argument(
            '--fixture',
            default=str(_repo_root() / 'frontend' / 'data' / 'golden-gate.json'),
            help='Path to golden-gate compatible JSON fixture.',
        )
        parser.add_argument('--dry-run', action='store_true', help='Preview without database writes.')
        parser.add_argument(
            '--fixture-reviewed',
            action='store_true',
            help='Mark publishable golden items as published by the fixture reviewer.',
        )
        parser.add_argument('--page-limit', type=int, default=100, help='Maximum fixture rows to process.')
        parser.add_argument('--owner', default='Content Relay', help='Connector owner recorded for audit.')
        parser.add_argument('--scheduled-at', default='', help='Optional scheduler timestamp recorded as heartbeat.')
        parser.add_argument('--max-retries', type=int, default=1, help='Retry failed item imports before marking the run failed.')
        parser.add_argument('--workspace', default='treefinance', help='ClawTree workspace slug.')

    def handle(self, *args, **options):
        started = time.monotonic()
        fixture_path = Path(options['fixture']).expanduser()
        if not fixture_path.exists():
            raise CommandError(f'Fixture not found: {fixture_path}')

        with fixture_path.open('r', encoding='utf-8') as handle:
            fixture = json.load(handle)

        content_items = fixture.get('contentItems', [])[: options['page_limit']]
        meta = fixture.get('meta', {})
        cursor_after = meta.get('version') or timezone.now().isoformat()
        dry_run = options['dry_run']
        workspace = Workspace.objects.get(slug=options['workspace'], is_active=True)

        report = {
            'workspace': workspace.slug,
            'connector': 'TreeFinance X',
            'fixture': str(fixture_path),
            'cursorAfter': cursor_after,
            'dryRun': dry_run,
            'fixtureReviewed': bool(options['fixture_reviewed']),
            'scheduledAt': options['scheduled_at'] or '',
            'maxRetries': options['max_retries'],
            'retryAttempts': 0,
            'collected': len(content_items),
            'saved': 0,
            'duplicates': 0,
            'failed': 0,
            'taxonomy': TAXONOMY,
            'alerts': [],
            'errors': [],
        }

        if dry_run:
            for item in content_items:
                report['saved'] += 1
                self.stdout.write(f"[DRY-RUN] {item.get('id')} {item.get('title')}")
            self.stdout.write(json.dumps(report, ensure_ascii=False, indent=2))
            return

        with transaction.atomic():
            connector, _ = SourceConnector.objects.get_or_create(
                workspace=workspace,
                name='TreeFinance X',
                platform='x',
                defaults={
                    'account_or_site': '@TreefinanceCN',
                    'auth_mode': 'api_key_ref',
                    'secret_ref': 'env:TREEFINANCE_X_BEARER_TOKEN',
                    'frequency': 'daily',
                    'daily_budget_cents': 500,
                    'status': 'active',
                    'owner': options['owner'],
                },
            )
            cursor_before = connector.cursor
            run = IngestionRun.objects.create(
                connector=connector,
                status='running',
                scheduled_at=_parse_dt(options['scheduled_at']) or timezone.now(),
                started_at=timezone.now(),
                cursor_before=cursor_before,
            )

            for item in content_items:
                try:
                    source_url = item.get('sourceUrl') or ''
                    title = item.get('title') or ''
                    if not source_url or not title:
                        report['failed'] += 1
                        report['errors'].append({'id': item.get('id'), 'error': 'missing_source_or_title'})
                        continue

                    digest = _content_hash(source_url, title)
                    if ContentItem.objects.filter(workspace=workspace, content_hash=digest).exists():
                        report['duplicates'] += 1
                        continue

                    expected = item.get('expected', {})
                    labels = expected.get('labels', [])
                    raw_text = f"{title}\n\nSource: {source_url}"
                    published_at = _parse_dt(item.get('publishedAt'))
                    fetched_at = _parse_dt(item.get('fetchedAt')) or timezone.now()
                    content = ContentItem.objects.create(
                        workspace=workspace,
                        connector=connector,
                        ingestion_run=run,
                        source_platform='x' if 'x.com/' in source_url else 'website',
                        source_url=source_url,
                        external_id=_external_id(source_url, item.get('id', '')),
                        publisher='TreeFinance' if 'Treefinance' in source_url or 'TreefinanceCN' in source_url else 'Public source',
                        published_at=published_at,
                        fetched_at=fetched_at,
                        raw_text=raw_text,
                        normalized_text=_normalize(raw_text),
                        content_hash=digest,
                        cluster_key=_cluster_key(item),
                        topic_scores={label: 1.0 for label in labels},
                        media_urls=[],
                        media_license_status='link_only',
                        source_metadata={
                            'fixtureId': item.get('id'),
                            'fixtureOnly': bool(item.get('fixtureOnly')),
                            'publicDisplayAllowed': bool(item.get('publicDisplayAllowed')),
                            'expectedAction': expected.get('action', ''),
                            'duplicateCandidateOf': expected.get('duplicateCandidateOf', ''),
                        },
                    )

                    publishable = bool(item.get('publicDisplayAllowed')) and bool(expected.get('publishableAfterReview'))
                    status = 'published' if options['fixture_reviewed'] and publishable else 'needs_review'
                    EditorialReview.objects.create(
                        content_item=content,
                        status=status,
                        classification=_classification(item),
                        risk_labels=RISK_LABELS.get(expected.get('risk', 'medium'), ['editorial_context_required']),
                        suggested_title=title,
                        suggested_text=_safe_summary(item),
                        diff_summary=_diff_summary(item),
                        source_refs=[{
                            'sourceId': item.get('id'),
                            'url': source_url,
                            'publishedAt': item.get('publishedAt'),
                            'fetchedAt': item.get('fetchedAt'),
                        }],
                        model_version='deterministic-fixture@2026-07-04',
                        reviewer='fixture-editor' if status == 'published' else '',
                        reviewed_at=timezone.now() if status == 'published' else None,
                        published_at=timezone.now() if status == 'published' else None,
                    )
                    report['saved'] += 1
                except Exception as error:  # pragma: no cover - defensive audit path
                    report['failed'] += 1
                    report['errors'].append({'id': item.get('id'), 'error': type(error).__name__})

            connector.cursor = cursor_after
            connector.save(update_fields=['cursor', 'updated_at'])

            run.status = 'succeeded' if report['failed'] == 0 else 'failed'
            run.finished_at = timezone.now()
            run.cursor_after = cursor_after
            run.collected_count = report['collected']
            run.new_count = report['saved']
            run.duplicate_count = report['duplicates']
            run.failed_count = report['failed']
            run.duration_ms = int((time.monotonic() - started) * 1000)
            run.retry_count = report['retryAttempts']
            if report['failed']:
                report['alerts'].append('content_relay_partial_failure')
            if report['collected'] and report['saved'] == 0 and report['duplicates'] == report['collected']:
                report['alerts'].append('content_relay_no_new_content')
            if report['failed']:
                run.error_code = 'content_relay_partial_failure'
                run.error_message = json.dumps(report['errors'], ensure_ascii=False)[:2000]
            run.save()

        self.stdout.write(self.style.SUCCESS(
            f"Content Relay done — saved {report['saved']}, duplicates {report['duplicates']}, failed {report['failed']}",
        ))
        self.stdout.write(json.dumps(report, ensure_ascii=False, indent=2))
