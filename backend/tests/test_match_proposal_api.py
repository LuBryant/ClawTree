from datetime import date, timedelta
from unittest.mock import patch

from django.core.cache import cache
from django.test import TestCase
from rest_framework.test import APIClient

from home.models import (
    Capability,
    CollaborationMatch,
    OutreachDraft,
    OutreachMessage,
    Proposal,
    UniversityEvent,
    Workspace,
)


class MatchProposalApiTests(TestCase):
    def setUp(self):
        cache.clear()
        self.client = APIClient()
        self.workspace = Workspace.objects.create(slug='api4-test', name='API 4 Test')
        self.event = UniversityEvent.objects.create(
            workspace=self.workspace,
            title='高校机器人与 AI 黑客松',
            university='测试大学',
            event_date=date.today() + timedelta(days=14),
            location='广州',
            description='面向大学生的机器人、AI 与 Web3 创新活动。',
            source_url='https://example.edu/events/robot-hackathon',
            registration_url='https://example.edu/register',
            category='AI+Web3',
            event_type='黑客松',
        )
        self.capability = Capability.objects.create(
            workspace=self.workspace,
            code='campus-hackathon',
            title='高校黑客松议题与媒体支持',
            source_ids=['capability-source-1'],
            owner='operator',
            valid_until=date.today() + timedelta(days=90),
            approved=True,
            boundary='嘉宾、奖金、费用和主办身份均需逐项人工确认。',
        )
        self.headers = {
            'HTTP_X_CLAWTREE_WORKSPACE': self.workspace.slug,
            'HTTP_X_CLAWTREE_OPERATOR': 'reviewer@example.test',
            'HTTP_X_INPUT_VERSION': 'match-rubric-v1',
        }

    def _post(self, path, payload, key):
        return self.client.post(
            path,
            payload,
            format='json',
            HTTP_IDEMPOTENCY_KEY=key,
            **self.headers,
        )

    def _generate_match(self):
        return self._post(
            '/api/admin/matches/generate/',
            {'event_id': self.event.id, 'capability_ids': [self.capability.id], 'campaign_key': 'robot-campus'},
            'match-create-1',
        )

    def test_generation_requires_mutation_contract(self):
        response = self.client.post(
            '/api/admin/matches/generate/',
            {'event_id': self.event.id},
            format='json',
            HTTP_X_CLAWTREE_WORKSPACE=self.workspace.slug,
        )
        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.json()['error']['code'], 'mutation_contract_required')
        self.assertFalse(response.json()['externalSideEffect'])

    @patch('home.api_views.send_mail')
    @patch('home.api_views._init_llm')
    def test_match_generation_is_cited_database_only_and_idempotent(self, init_llm, send_mail):
        first = self._generate_match()
        second = self._generate_match()

        self.assertEqual(first.status_code, 201, first.content)
        self.assertEqual(second.status_code, 200, second.content)
        self.assertFalse(first.json()['externalSideEffect'])
        self.assertEqual(first.json()['audit_id'], second.json()['audit_id'])
        self.assertTrue(second.json()['data']['idempotent_replay'])
        self.assertEqual(CollaborationMatch.objects.count(), 1)
        match = CollaborationMatch.objects.get()
        self.assertEqual(set(match.score_citations), set(CollaborationMatch.SCORE_DIMENSIONS))
        self.assertTrue(all(match.score_citations.values()))
        init_llm.assert_not_called()
        send_mail.assert_not_called()

    def test_proposal_requires_verified_match(self):
        match_id = self._generate_match().json()['data']['match']['id']
        response = self._post(
            '/api/admin/proposals/generate/',
            {'match_id': match_id},
            'proposal-unverified-1',
        )
        self.assertEqual(response.status_code, 409)
        self.assertEqual(response.json()['error']['code'], 'verified_match_required')
        self.assertEqual(Proposal.objects.count(), 0)

    @patch('home.api_views.send_mail')
    @patch('home.api_views._init_llm')
    def test_verified_match_generates_three_tier_draft_without_outreach(self, init_llm, send_mail):
        match_id = self._generate_match().json()['data']['match']['id']
        verified = self._post(f'/api/admin/matches/{match_id}/verify/', {}, 'match-verify-1')
        self.assertEqual(verified.status_code, 200, verified.content)

        first = self._post('/api/admin/proposals/generate/', {'match_id': match_id}, 'proposal-create-1')
        second = self._post('/api/admin/proposals/generate/', {'match_id': match_id}, 'proposal-create-1')

        self.assertEqual(first.status_code, 201, first.content)
        self.assertEqual(second.status_code, 200, second.content)
        payload = first.json()
        proposal = Proposal.objects.get()
        self.assertFalse(payload['externalSideEffect'])
        self.assertEqual(proposal.status, 'draft')
        self.assertEqual([item['name'] for item in proposal.packages], ['light', 'medium', 'deep'])
        self.assertTrue(proposal.guardrail_checks['humanApprovalRequired'])
        self.assertFalse(proposal.guardrail_checks['externalSideEffectsAllowed'])
        self.assertEqual(Proposal.objects.count(), 1)
        self.assertEqual(OutreachDraft.objects.count(), 0)
        self.assertEqual(OutreachMessage.objects.count(), 0)
        init_llm.assert_not_called()
        send_mail.assert_not_called()

    def test_idempotency_key_cannot_be_reused_for_different_input(self):
        first = self._generate_match()
        self.assertEqual(first.status_code, 201, first.content)
        conflict = self._post(
            '/api/admin/matches/generate/',
            {'event_id': self.event.id, 'capability_ids': [], 'campaign_key': 'different'},
            'match-create-1',
        )
        self.assertEqual(conflict.status_code, 409)
        self.assertEqual(conflict.json()['error']['code'], 'idempotency_key_conflict')
        self.assertEqual(CollaborationMatch.objects.count(), 1)
