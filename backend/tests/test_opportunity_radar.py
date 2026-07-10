from datetime import timedelta

from django.core.exceptions import ValidationError
from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient

from home.models import UniversityEvent, Workspace


class CampusOpportunityRadarTests(TestCase):
    def setUp(self):
        self.workspace = Workspace.objects.create(slug='radar', name='Radar Workspace')
        self.client = APIClient()
        self.now = timezone.now()

    def make_event(self, **overrides):
        data = {
            'workspace': self.workspace,
            'title': 'Official Campus AI × Web3 Hackathon',
            'university': 'Example University',
            'event_date': timezone.localdate() + timedelta(days=14),
            'event_end_date': timezone.localdate() + timedelta(days=15),
            'location': 'Innovation Center',
            'description': 'An official campus innovation event.',
            'source_url': 'https://example.edu/official/hackathon',
            'source_name': 'Example University',
            'registration_url': 'https://example.edu/official/hackathon/register',
            'registration_status': 'open',
            'source_tier': 'official_university',
            'page_last_checked_at': self.now,
        }
        data.update(overrides)
        return UniversityEvent.objects.create(**data)

    def test_confidence_has_explainable_officiality_completeness_freshness_and_date_subscores(self):
        event = self.make_event()
        explanation = event.refresh_radar_assessment(reference_time=self.now)
        event.save()

        self.assertEqual(explanation['version'], 'campus-radar-v1')
        self.assertEqual(explanation['subscores'], {
            'officiality': 100,
            'completeness': 100,
            'freshness': 100,
            'date_consistency': 100,
        })
        self.assertEqual(event.score, 100)
        self.assertEqual(event.freshness_status, 'fresh')
        self.assertEqual(event.verification_queue_reasons, [])

    def test_expired_conflicting_cancelled_and_stale_events_fail_closed_into_queue(self):
        event = self.make_event(
            source_url='https://example.edu/official/old-event',
            event_date=timezone.localdate() - timedelta(days=5),
            event_end_date=timezone.localdate() - timedelta(days=6),
            event_status='cancelled',
            postponement_note='Official page says the event was cancelled.',
            page_last_checked_at=self.now - timedelta(days=45),
        )
        event.refresh_radar_assessment(reference_time=self.now)
        event.save()

        self.assertEqual(event.verification_status, 'pending')
        self.assertTrue({'expired', 'date_conflict', 'cancelled', 'page_not_fresh'}.issubset(
            set(event.verification_queue_reasons)
        ))
        with self.assertRaises(ValidationError):
            event.mark_verified(reviewer='human-reviewer', reference_time=self.now)

    def test_timezone_and_postponement_evidence_are_validated(self):
        with self.assertRaises(ValidationError):
            self.make_event(source_url='https://example.edu/bad-timezone', timezone_name='Mars/Olympus')
        with self.assertRaises(ValidationError):
            self.make_event(source_url='https://example.edu/postponed', event_status='postponed')

    def test_public_api_only_returns_human_verified_non_expired_scheduled_events(self):
        visible = self.make_event()
        visible.mark_verified(reviewer='radar-editor', reference_time=self.now)
        visible.save()

        expired = self.make_event(
            source_url='https://example.edu/expired',
            event_date=timezone.localdate() - timedelta(days=2),
            event_end_date=timezone.localdate() - timedelta(days=1),
        )
        expired.verification_status = 'verified'
        expired.verified_by = 'legacy-reviewer'
        expired.verified_at = self.now
        expired.save()
        self.make_event(source_url='https://example.edu/pending')

        response = self.client.get('/api/user/events/', HTTP_X_CLAWTREE_WORKSPACE=self.workspace.slug)
        self.assertEqual(response.status_code, 200, response.content)
        payload = response.json()
        results = payload.get('results', payload)
        self.assertEqual([item['id'] for item in results], [visible.id])
        self.assertNotIn('verification_queue_reasons', results[0])
        self.assertNotIn('score', results[0])

    def test_admin_assess_verify_and_reject_actions(self):
        event = self.make_event()
        headers = {
            'HTTP_X_CLAWTREE_WORKSPACE': self.workspace.slug,
            'HTTP_X_CLAWTREE_OPERATOR': 'event-reviewer',
        }
        assessed = self.client.post(f'/api/events/{event.id}/assess/', {}, format='json', **headers)
        self.assertEqual(assessed.status_code, 200, assessed.content)
        self.assertEqual(assessed.json()['confidence_explanation']['overall'], 100)

        verified = self.client.post(f'/api/events/{event.id}/verify/', {}, format='json', **headers)
        self.assertEqual(verified.status_code, 200, verified.content)
        self.assertEqual(verified.json()['verification_status'], 'verified')
        self.assertEqual(verified.json()['verified_by'], 'event-reviewer')

        rejected = self.client.post(
            f'/api/events/{event.id}/reject/', {'note': 'Official page was superseded.'},
            format='json', **headers,
        )
        self.assertEqual(rejected.status_code, 200, rejected.content)
        self.assertEqual(rejected.json()['verification_status'], 'rejected')

