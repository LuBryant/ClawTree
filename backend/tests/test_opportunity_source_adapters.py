import json
import os
from contextlib import redirect_stdout
from io import StringIO
from pathlib import Path
from unittest.mock import patch

from django.core.management import call_command
from django.test import SimpleTestCase

from home.opportunity_radar import OpportunityEvent, SourceCandidate, extract_event
from home.opportunity_radar.schema import SCHEMA_VERSION
from home.opportunity_radar.sources import SOURCE_ADAPTERS, build_adapter


FIXTURE_DIR = Path(__file__).parent / 'fixtures' / 'opportunity_radar'


class OpportunitySourceAdapterTests(SimpleTestCase):
    @classmethod
    def setUpClass(cls):
        super().setUpClass()
        cls.ground_truth = json.loads((FIXTURE_DIR / 'ground_truth.json').read_text(encoding='utf-8'))

    def test_each_source_runs_independently_with_the_same_candidate_schema(self):
        expected_keys = set(SourceCandidate.__dataclass_fields__)
        for source_id in SOURCE_ADAPTERS:
            with self.subTest(source=source_id):
                adapter = build_adapter(source_id, fixture_path=FIXTURE_DIR / f'{source_id}.json')
                candidates = adapter.discover(max_results=10)
                self.assertEqual(len(candidates), 1)
                self.assertEqual(set(candidates[0].to_dict()), expected_keys)
                self.assertEqual(candidates[0].source_id, source_id)
                self.assertTrue(candidates[0].raw_evidence)

    def test_field_extraction_matches_ground_truth_for_every_source(self):
        strict_keys = set(OpportunityEvent.__dataclass_fields__)
        checked_fields = (
            'title', 'university', 'topic', 'format', 'location',
            'starts_at', 'ends_at', 'registration_url',
        )
        for source_id, expected in self.ground_truth.items():
            with self.subTest(source=source_id):
                adapter = build_adapter(source_id, fixture_path=FIXTURE_DIR / f'{source_id}.json')
                candidate = adapter.discover()[0]
                event = extract_event(candidate, adapter.fetch_detail(candidate))
                self.assertEqual(set(event.to_dict()), strict_keys)
                self.assertEqual(event.schema_version, SCHEMA_VERSION)
                for field in checked_fields:
                    self.assertEqual(getattr(event, field), expected[field], field)
                evidence_fields = {item.field for item in event.evidence}
                self.assertTrue(set(checked_fields).issubset(evidence_fields))
                self.assertTrue(event.raw_evidence)

    def test_management_command_runs_all_fixtures_without_any_api_key(self):
        stdout = StringIO()
        clean_environment = {
            key: value for key, value in os.environ.items()
            if not key.endswith('_API_KEY') and key != 'OPENAI_API_KEY'
        }
        with patch.dict(os.environ, clean_environment, clear=True), redirect_stdout(stdout):
            call_command(
                'fetch_events',
                fixture_dir=str(FIXTURE_DIR),
                dry_run=True,
                output_json=True,
                score_min=3,
                stdout=stdout,
            )
        rendered = stdout.getvalue()
        self.assertIn('completed: saved=3 skipped=0 candidates=3', rendered)
        self.assertIn('campus-opportunity.v1', rendered)

    def test_fixture_requires_an_explicit_single_source(self):
        with self.assertRaisesMessage(Exception, '--fixture requires one explicit --source'):
            call_command('fetch_events', fixture=str(FIXTURE_DIR / 'bing.json'), dry_run=True)
