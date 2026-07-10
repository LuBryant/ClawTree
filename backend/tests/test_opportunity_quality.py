import json
from io import StringIO
from pathlib import Path
from tempfile import NamedTemporaryFile

from django.core.management import call_command
from django.test import TestCase

from home.models import ContactPoint, UniversityEvent, Workspace
from home.opportunity_quality import evaluate_quality_fixture, validate_contact_candidate


QUALITY_FIXTURE = Path(__file__).resolve().parents[1] / 'data' / 'quality' / 'campus-opportunity-eval.json'


class CampusOpportunityQualityTests(TestCase):
    def setUp(self):
        self.workspace = Workspace.objects.create(slug='radar-quality', name='Radar Quality')

    def test_or10_fixture_covers_required_failures_and_matches_ground_truth(self):
        payload = json.loads(QUALITY_FIXTURE.read_text(encoding='utf-8'))
        report = evaluate_quality_fixture(payload)

        self.assertEqual(report['failed'], 0, report)
        self.assertEqual(report['passed'], len(payload['cases']))
        covered = set(report['issue_counts'])
        self.assertTrue({
            'duplicate', 'expired', 'invalid_email', 'no_official_source',
            'personal_email_provider', 'guessed_contact',
        }.issubset(covered))

    def test_contact_validation_fails_closed_for_private_guessed_or_unevidenced_email(self):
        baseline = {
            'channel': 'email',
            'value': 'events@example.edu',
            'purpose': 'event',
            'evidence_url': 'https://events.example.edu/notice#contact',
            'contact_scope': 'event',
            'provenance': 'published',
            'is_public_business_contact': True,
        }
        self.assertEqual(validate_contact_candidate(baseline), [])
        self.assertIn(
            'personal_email_provider',
            validate_contact_candidate({**baseline, 'value': 'organizer@gmail.com'}),
        )
        self.assertIn(
            'guessed_contact',
            validate_contact_candidate({**baseline, 'provenance': 'guessed'}),
        )
        self.assertEqual(
            validate_contact_candidate({
                **baseline, 'evidence_url': '', 'purpose': '',
            }),
            ['missing_evidence_url', 'missing_purpose'],
        )

    def test_save_events_writes_only_evidenced_public_email_to_contact_point(self):
        payload = {
            'meta': {'source': 'test-fixture', 'query_time': '2026-07-11T12:00:00+08:00'},
            'events': [{
                'title': 'Campus AI Workshop',
                'university': 'Example University',
                'event_date': '2026-08-20',
                'source_url': 'https://events.example.edu/workshop',
                'contact_email': 'legacy@example.edu',
                'contact_phone': '13800138000',
                'contact_points': [
                    {
                        'channel': 'email',
                        'value': 'events@example.edu',
                        'purpose': 'event',
                        'evidence_url': 'https://events.example.edu/workshop#contact',
                        'contact_scope': 'event',
                        'provenance': 'published',
                        'is_public_business_contact': True,
                        'verification_status': 'verified',
                        'confidence': 94,
                    },
                    {
                        'channel': 'email',
                        'value': 'organizer@gmail.com',
                        'purpose': 'event',
                        'evidence_url': 'https://events.example.edu/workshop#contact',
                        'contact_scope': 'private',
                        'provenance': 'published',
                        'is_public_business_contact': False,
                    },
                    {
                        'channel': 'email',
                        'value': 'partnerships@example.edu',
                        'purpose': 'collaboration',
                        'evidence_url': 'https://events.example.edu/workshop',
                        'contact_scope': 'institution',
                        'provenance': 'guessed',
                        'is_guessed': True,
                        'is_public_business_contact': True,
                    },
                ],
            }],
        }
        with NamedTemporaryFile(mode='w', suffix='.json', encoding='utf-8') as fixture:
            json.dump(payload, fixture, ensure_ascii=False)
            fixture.flush()
            stdout = StringIO()
            call_command(
                'save_events', fixture.name, workspace=self.workspace.slug,
                stdout=stdout, stderr=StringIO(),
            )

        event = UniversityEvent.objects.get(workspace=self.workspace)
        self.assertEqual(event.contact_email, '')
        self.assertEqual(event.contact_phone, '')
        self.assertNotIn('legacy@example.edu', event.raw_data)
        self.assertNotIn('organizer@gmail.com', event.raw_data)
        self.assertTrue(json.loads(event.raw_data)['contact_data_redacted'])
        contact = ContactPoint.objects.get(university_event=event)
        self.assertEqual(contact.value, 'events@example.edu')
        self.assertEqual(contact.purpose, 'event')
        self.assertEqual(contact.evidence_url, 'https://events.example.edu/workshop#contact')
        self.assertTrue(contact.is_public_business_contact)
        self.assertEqual(contact.verification_status, 'unverified')
        output = stdout.getvalue()
        self.assertIn('"contacts_saved": 1', output)
        self.assertIn('"contacts_rejected": 2', output)
        self.assertNotIn('organizer@gmail.com', output)

    def test_save_events_contact_import_is_idempotent_and_legacy_without_metadata_is_rejected(self):
        payload = {
            'events': [{
                'title': 'Campus Web3 Forum',
                'university': 'Example University',
                'event_date': '2026-09-01',
                'source_url': 'https://events.example.edu/web3-forum',
                'contact': {'official_email': 'info@example.edu'},
            }],
        }
        with NamedTemporaryFile(mode='w', suffix='.json', encoding='utf-8') as fixture:
            json.dump(payload, fixture, ensure_ascii=False)
            fixture.flush()
            first = StringIO()
            call_command('save_events', fixture.name, workspace=self.workspace.slug, stdout=first, stderr=StringIO())
            second = StringIO()
            call_command('save_events', fixture.name, workspace=self.workspace.slug, stdout=second, stderr=StringIO())

        self.assertEqual(UniversityEvent.objects.filter(workspace=self.workspace).count(), 1)
        self.assertEqual(ContactPoint.objects.count(), 0)
        self.assertIn('"contacts_rejected": 1', first.getvalue())
        self.assertIn('"skipped": 1', second.getvalue())

    def test_quality_report_command_is_offline_and_passes(self):
        stdout = StringIO()
        call_command('evaluate_campus_opportunities', stdout=stdout)
        report = json.loads(stdout.getvalue())
        self.assertEqual(report['failed'], 0)
        self.assertEqual(report['total'], 8)
