from datetime import timedelta

from django.core.exceptions import ValidationError
from django.test import TestCase
from django.utils import timezone

from home.models import (
    AgentRun,
    CollaborationMatch,
    ContactPoint,
    OutreachBatch,
    OutreachMessage,
    Proposal,
    UniversityEvent,
    Workspace,
)
from home.serializers import AgentRunSerializer, UniversityEventSerializer


class DataGrowthModelTests(TestCase):
    def setUp(self):
        self.workspace = Workspace.objects.create(slug='growth', name='Growth Workspace')
        self.event = UniversityEvent.objects.create(
            workspace=self.workspace,
            title='Campus AI Hackathon',
            university='Example University',
            description='AI and Web3 student event',
            source_url='https://example.edu/events/ai-hackathon',
        )
        self.now = timezone.now()
        self.citations = [
            {
                'id': f'event:{self.event.id}',
                'type': 'event_source',
                'label': self.event.title,
                'url': self.event.source_url,
            },
            {
                'id': 'capability:media',
                'type': 'approved_capability',
                'label': 'Media support',
                'source_ids': ['capability-evidence-1'],
            },
        ]
        self.score_citations = {
            'theme': [f'event:{self.event.id}', 'capability:media'],
            'audience': [f'event:{self.event.id}'],
            'timing': [f'event:{self.event.id}'],
            'city': [f'event:{self.event.id}'],
            'resources': ['capability:media'],
            'information': [f'event:{self.event.id}'],
        }

    def make_match(self, **overrides):
        data = {
            'workspace': self.workspace,
            'event': self.event,
            'campaign_key': 'campus-2026',
            'status': 'suggested',
            'overall_score': 80,
            'theme_score': 90,
            'audience_score': 85,
            'timing_score': 75,
            'city_score': 70,
            'resource_score': 80,
            'information_score': 80,
            'fit_points': ['AI theme matches an approved capability.'],
            'missing_information': ['Budget requires confirmation.'],
            'conflicts': [],
            'citations': self.citations,
            'score_citations': self.score_citations,
            'scoring_version': 'rubric-v1',
            'model_version': 'deterministic-v1',
        }
        data.update(overrides)
        return CollaborationMatch.objects.create(**data)

    def proposal_payload(self):
        return {
            'packages': [
                {'name': 'light', 'value': 'Content support', 'resources': ['recap'], 'nextStep': 'Confirm scope'},
                {'name': 'medium', 'value': 'Speaker session', 'resources': ['speaker'], 'nextStep': 'Confirm speaker'},
                {'name': 'deep', 'value': 'Joint event', 'resources': ['program'], 'nextStep': 'Confirm approvals'},
            ],
            'partner_value': 'A cited, tiered collaboration path.',
            'workspace_value': 'A reusable campus partnership case.',
            'resources': ['approved capability: media'],
            'pending_questions': ['Who owns the final approval?'],
            'risks': ['All resources remain subject to human approval.'],
            'source_refs': [f'event:{self.event.id}', 'capability:media'],
            'evidence': [{
                'claimId': 'proposal_basis',
                'claim': 'The event theme matches an approved capability.',
                'sourceIds': [f'event:{self.event.id}', 'capability:media'],
            }],
            'guardrail_checks': {
                'noUnapprovedPrize': True,
                'noGuaranteedExposure': True,
                'humanApprovalRequired': True,
            },
        }

    def test_public_event_serializer_excludes_all_contact_points(self):
        contact = ContactPoint.objects.create(
            university_event=self.event,
            channel='email',
            value='events@example.edu',
            purpose='collaboration',
            evidence_url='https://example.edu/contact',
            confidence=95,
            verification_status='verified',
            is_public_business_contact=True,
        )
        payload = UniversityEventSerializer(self.event).data
        self.assertNotIn('contact_points', payload)
        self.assertNotIn('contact_email', payload)
        self.assertNotIn(contact.value, str(payload))

    def test_contact_requires_ordered_verification_and_public_flag(self):
        with self.assertRaises(ValidationError):
            ContactPoint.objects.create(
                university_event=self.event,
                channel='email',
                value='events@example.edu',
                purpose='event',
                evidence_url='https://example.edu/contact',
                first_verified_at=self.now,
                last_verified_at=self.now - timedelta(days=1),
            )
        with self.assertRaises(ValidationError):
            ContactPoint.objects.create(
                university_event=self.event,
                channel='email',
                value='events@example.edu',
                purpose='event',
                evidence_url='https://example.edu/contact',
                verification_status='verified',
                is_public_business_contact=False,
            )

    def test_every_match_score_dimension_requires_a_known_citation(self):
        invalid = dict(self.score_citations)
        invalid['resources'] = ['missing-reference']
        with self.assertRaises(ValidationError):
            self.make_match(score_citations=invalid)
        match = self.make_match()
        match.transition_to('verified', reviewer='human-reviewer')
        match.save()
        self.assertEqual(match.status, 'verified')
        self.assertIsNotNone(match.reviewed_at)

    def test_proposal_versions_are_unique_and_form_a_contiguous_chain(self):
        match = self.make_match()
        match.transition_to('verified', reviewer='human-reviewer')
        match.save()
        v1 = Proposal.objects.create(match=match, version=1, **self.proposal_payload())
        v2 = Proposal.objects.create(
            match=match, version=2, previous_version=v1,
            edit_summary='Human revised the scope.', edited_by='proposal-editor',
            **self.proposal_payload(),
        )
        self.assertEqual(v2.previous_version, v1)
        with self.assertRaises(ValidationError):
            Proposal.objects.create(match=match, version=2, previous_version=v1, **self.proposal_payload())
        with self.assertRaises(ValidationError):
            Proposal.objects.create(match=match, version=4, previous_version=v2, **self.proposal_payload())

    def test_outreach_is_one_message_per_school_and_send_path_is_approved(self):
        match = self.make_match()
        match.transition_to('verified', reviewer='human-reviewer')
        match.save()
        proposal = Proposal.objects.create(
            match=match,
            version=1,
            status='approved',
            approved_by='proposal-approver',
            approved_at=self.now,
            **self.proposal_payload(),
        )
        contact = ContactPoint.objects.create(
            university_event=self.event,
            channel='email',
            value='partnerships@example.edu',
            purpose='collaboration',
            evidence_url='https://example.edu/contact',
            confidence=95,
            verification_status='verified',
            is_public_business_contact=True,
        )
        batch = OutreachBatch.objects.create(
            workspace=self.workspace,
            name='Campus pilot',
            status='approved',
            created_by='operator',
            approved_by='batch-approver',
            approved_at=self.now,
        )
        message_data = {
            'batch': batch,
            'university_event': self.event,
            'proposal': proposal,
            'proposal_version': proposal.version,
            'contact_point': contact,
            'contact_evidence_url': contact.evidence_url,
            'contact_verified_at': contact.last_verified_at,
            'subject': 'A personal campus proposal',
            'body': 'This is an individual, evidence-bound message.',
            'personalization': ['Campus AI Hackathon'],
            'citation_ids': [f'event:{self.event.id}'],
            'guardrail_checks': {'unsubscribe_checked': True},
            'status': 'approved',
            'approved_by': 'message-approver',
            'approved_at': self.now,
        }
        first = OutreachMessage.objects.create(idempotency_key='campus-2026:example:v1', **message_data)
        self.assertEqual(first.proposal_version, 1)
        with self.assertRaises(ValidationError):
            OutreachMessage.objects.create(idempotency_key='another-key', **message_data)
        second_event = UniversityEvent.objects.create(
            workspace=self.workspace,
            title='Another event at the same school',
            university='  Example   University ',
            source_url='https://example.edu/events/another',
        )
        second_ref = f'event:{second_event.id}'
        second_match = CollaborationMatch.objects.create(
            workspace=self.workspace, event=second_event, campaign_key='campus-2026-second',
            status='suggested', overall_score=70, theme_score=70, audience_score=70,
            timing_score=70, city_score=70, resource_score=70, information_score=70,
            citations=[{'id': second_ref, 'type': 'event_source', 'source_id': second_event.id}],
            score_citations={key: [second_ref] for key in CollaborationMatch.SCORE_DIMENSIONS},
            scoring_version='rubric-v1', model_version='deterministic-v1',
        )
        second_match.transition_to('verified', reviewer='human-reviewer')
        second_match.save()
        second_payload = self.proposal_payload()
        second_payload['source_refs'] = [second_ref]
        second_payload['evidence'] = [{
            'claimId': 'proposal_basis', 'claim': 'Same school, separate event.', 'sourceIds': [second_ref],
        }]
        second_proposal = Proposal.objects.create(
            match=second_match, version=1, status='approved', approved_by='proposal-approver',
            approved_at=self.now, **second_payload,
        )
        second_contact = ContactPoint.objects.create(
            university_event=second_event, channel='email', value='events2@example.edu',
            purpose='collaboration', evidence_url='https://example.edu/contact', confidence=95,
            verification_status='verified', is_public_business_contact=True,
        )
        with self.assertRaises(ValidationError):
            OutreachMessage.objects.create(
                batch=batch, university_event=second_event, proposal=second_proposal,
                proposal_version=1, contact_point=second_contact,
                contact_evidence_url=second_contact.evidence_url,
                contact_verified_at=second_contact.last_verified_at,
                idempotency_key='same-school-other-event', subject='Second subject', body='Second body',
                citation_ids=[second_ref], guardrail_checks={'unsubscribe_checked': True},
            )
        first.contact_point.verification_status = 'opted_out'
        first.contact_point.save()
        with self.assertRaises(ValidationError):
            OutreachMessage.objects.create(
                idempotency_key='opted-out-key',
                **{**message_data, 'batch': OutreachBatch.objects.create(
                    workspace=self.workspace, name='Second pilot', status='approved', created_by='operator',
                    approved_by='batch-approver', approved_at=self.now,
                )},
            )

    def test_agent_run_trace_is_observable_but_rejects_raw_pii(self):
        run = AgentRun.objects.create(
            workspace=self.workspace,
            task_type='proposal',
            status='succeeded',
            model_provider='openai-compatible',
            model_name='example-model',
            model_version='model-v1',
            schema_name='proposal',
            schema_version='schema-v1',
            prompt_version='prompt-v1',
            input_references=[f'event:{self.event.id}'],
            citations=[f'event:{self.event.id}'],
            input_snapshot={'event_id': self.event.id, 'description': '[REDACTED]'},
            structured_output={'proposal_id': 'proposal-v1', 'summary': 'three cited tiers'},
            input_tokens=120,
            output_tokens=80,
            cached_input_tokens=20,
            latency_ms=450,
            cost_microusd=1250,
            privacy_status='redacted',
            redacted_fields=['event.description'],
            finished_at=self.now,
        )
        trace = AgentRunSerializer(run).data
        self.assertEqual(trace['total_tokens'], 200)
        self.assertEqual(trace['schema_version'], 'schema-v1')
        self.assertEqual(trace['citations'], [f'event:{self.event.id}'])
        self.assertNotIn('raw_prompt', trace)
        with self.assertRaises(ValidationError):
            AgentRun.objects.create(
                workspace=self.workspace,
                task_type='draft',
                model_version='model-v1',
                schema_name='draft',
                schema_version='schema-v1',
                input_references=[f'event:{self.event.id}'],
                input_snapshot={'recipient_email': 'private@example.edu'},
            )
