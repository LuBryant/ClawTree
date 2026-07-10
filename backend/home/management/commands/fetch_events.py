"""Discover campus opportunities through independently runnable adapters.

Examples:
    python manage.py fetch_events --source bing --dry-run
    python manage.py fetch_events --source ccf --fixture tests/fixtures/opportunity_radar/ccf.json --output-json
    python manage.py fetch_events --fixture-dir tests/fixtures/opportunity_radar --dry-run

The fixture and live paths use the same adapters and strict extraction schema.
No search-provider or LLM key is required.
"""
import json
import os
from datetime import date, datetime
from pathlib import Path

from django.core.management.base import BaseCommand, CommandError

from home.models import UniversityEvent
from home.opportunity_radar import extract_event
from home.opportunity_radar.sources import SOURCE_ADAPTERS, build_adapter


SEARCH_KEYWORDS = [
    '高校 AI 讲座 2026',
    '高校 人工智能 论坛 2026',
    '高校 区块链 Web3 活动',
    '大学 黑客松 AI',
    '大学 Web3 峰会',
]


class Command(BaseCommand):
    help = '通过 Bing、CCF、活动行 source adapters 检索高校 AI/Web3 活动'

    def add_arguments(self, parser):
        parser.add_argument('--max-results', type=int, default=10, help='每来源最大候选数')
        parser.add_argument('--dry-run', action='store_true', help='仅发现和提取，不入库')
        parser.add_argument('--output-json', action='store_true', help='输出严格 schema JSON')
        parser.add_argument('--score-min', type=int, default=3, help='最低字段完整度评分（0-10）')
        parser.add_argument('--keywords', type=str, help='逗号分隔的自定义关键词')
        parser.add_argument(
            '--source',
            choices=['all', *SOURCE_ADAPTERS],
            default='all',
            help='单独运行一个来源，或运行全部来源',
        )
        parser.add_argument(
            '--fixture',
            type=str,
            help='单来源 fixture JSON；必须与 --source bing|ccf|huodongxing 一起使用',
        )
        parser.add_argument(
            '--fixture-dir',
            type=str,
            help='离线 fixture 目录，按 bing.json/ccf.json/huodongxing.json 加载',
        )

    def handle(self, *args, **options):
        if options['fixture'] and options['source'] == 'all':
            raise CommandError('--fixture requires one explicit --source')
        if options['fixture'] and options['fixture_dir']:
            raise CommandError('--fixture and --fixture-dir are mutually exclusive')

        keywords = self._keywords(options.get('keywords'))
        source_ids = list(SOURCE_ADAPTERS) if options['source'] == 'all' else [options['source']]
        candidates = []
        adapters = {}

        for source_id in source_ids:
            fixture_path = self._fixture_path(source_id, options)
            adapter = build_adapter(source_id, fixture_path=fixture_path)
            adapters[source_id] = adapter
            try:
                discovered = adapter.discover(keywords, options['max_results'])
            except Exception as error:
                self.stderr.write(f'[{source_id}] discovery failed: {error}')
                continue
            candidates.extend(discovered)
            self.stdout.write(f'[{source_id}] discovered {len(discovered)} candidates')

        unique_candidates = []
        seen_urls = set()
        for candidate in candidates:
            if candidate.url not in seen_urls:
                seen_urls.add(candidate.url)
                unique_candidates.append(candidate)

        saved = skipped = 0
        output = []
        for candidate in unique_candidates:
            adapter = adapters[candidate.source_id]
            try:
                event = extract_event(candidate, adapter.fetch_detail(candidate))
            except Exception as error:
                skipped += 1
                self.stderr.write(f'[{candidate.source_id}] extraction failed for {candidate.url}: {error}')
                continue

            score = self._completeness_score(event)
            if event.topic == 'other' or score < options['score_min']:
                skipped += 1
                continue
            item = event.to_storage_dict()
            item['score'] = score
            output.append(item)

            if options['dry_run']:
                saved += 1
                self.stdout.write(self.style.WARNING(
                    f'[DRY-RUN] [{event.topic}] {event.title} — {event.university or "高校待核验"}'
                ))
                continue

            _, created = UniversityEvent.objects.update_or_create(
                source_url=event.source_url,
                defaults={
                    'title': event.title[:500],
                    'university': event.university[:200],
                    'event_date': self._parse_date(event.starts_at),
                    'event_end_date': self._parse_date(event.ends_at),
                    'location': event.location[:300],
                    'description': event.description[:1000],
                    'source_name': event.source_name[:100],
                    'category': event.topic,
                    'event_type': event.event_type,
                    'registration_url': event.registration_url[:500],
                    'score': score,
                    'is_contacted': False,
                    'raw_data': json.dumps(item, ensure_ascii=False, sort_keys=True),
                },
            )
            saved += int(created)

        self.stdout.write(self.style.SUCCESS(
            f'completed: saved={saved} skipped={skipped} candidates={len(unique_candidates)}'
        ))
        if options['output_json']:
            self.stdout.write(json.dumps(output, ensure_ascii=False, indent=2, sort_keys=True))

    @staticmethod
    def _keywords(value):
        keywords = [item.strip() for item in (value or '').split(',') if item.strip()]
        if not keywords:
            keywords = SEARCH_KEYWORDS[:]
            keywords.extend(
                item.strip()
                for item in os.environ.get('UNIVERSITY_SEARCH_KEYWORDS', '').split(',')
                if item.strip()
            )
        return keywords

    @staticmethod
    def _fixture_path(source_id, options):
        if options.get('fixture'):
            return options['fixture']
        if options.get('fixture_dir'):
            path = Path(options['fixture_dir']) / f'{source_id}.json'
            if not path.exists():
                raise CommandError(f'missing fixture: {path}')
            return str(path)
        return None

    @staticmethod
    def _completeness_score(event):
        fields = (
            event.title,
            event.university,
            event.topic != 'other',
            event.format != 'unknown',
            event.location,
            event.starts_at,
            event.ends_at,
            event.registration_url,
            event.description,
            event.raw_evidence,
        )
        return sum(bool(value) for value in fields)

    @staticmethod
    def _parse_date(value):
        if not value:
            return None
        if isinstance(value, date):
            return value
        try:
            return datetime.fromisoformat(str(value)[:10]).date()
        except (TypeError, ValueError):
            return None
