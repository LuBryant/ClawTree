"""Generate the deterministic OR-10 Campus Opportunity Radar quality report."""

import json
from pathlib import Path

from django.core.management.base import BaseCommand, CommandError

from home.opportunity_quality import evaluate_quality_fixture


DEFAULT_FIXTURE = Path(__file__).resolve().parents[3] / 'data' / 'quality' / 'campus-opportunity-eval.json'


class Command(BaseCommand):
    help = '评估高校活动重复、过期、来源与联系人质量，不访问网络或模型'

    def add_arguments(self, parser):
        parser.add_argument('fixture', nargs='?', default=str(DEFAULT_FIXTURE))
        parser.add_argument('--output', help='可选 JSON 报告输出路径')

    def handle(self, *args, **options):
        fixture_path = Path(options['fixture']).resolve()
        try:
            payload = json.loads(fixture_path.read_text(encoding='utf-8'))
        except (OSError, json.JSONDecodeError) as error:
            raise CommandError(f'Cannot read quality fixture: {error}') from error

        report = evaluate_quality_fixture(payload)
        rendered = json.dumps(report, ensure_ascii=False, indent=2) + '\n'
        if options.get('output'):
            output_path = Path(options['output']).resolve()
            output_path.parent.mkdir(parents=True, exist_ok=True)
            output_path.write_text(rendered, encoding='utf-8')
            self.stdout.write(f'report: {output_path}')
        self.stdout.write(rendered.rstrip())

        if report['failed']:
            raise CommandError(f"{report['failed']} quality fixture case(s) failed")
