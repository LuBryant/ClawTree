from datetime import timedelta

from django.core.exceptions import ValidationError
from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient

from home.agent_observability import (
    agent_metrics,
    claim_daily_budget,
    evaluate_ingestion_alerts,
    record_tool_call,
)
from home.models import AgentRun, DailyAgentBudget, IngestionRun, SourceConnector, Workspace


class AgentObservabilityTests(TestCase):
    def setUp(self):
        self.workspace = Workspace.objects.create(slug='obs', name='Observability')
        self.now = timezone.now()

    def make_run(self, task='classify', status='succeeded', latency=100, cost=10, **extra):
        return AgentRun.objects.create(
            workspace=self.workspace, task_type=task, status=status,
            model_provider='fixture', model_name='fixture', model_version='v1',
            schema_name=task, schema_version='v1', input_references=['source:1'],
            latency_ms=latency, cost_microusd=cost, input_tokens=10, output_tokens=5,
            started_at=self.now, finished_at=self.now, **extra,
        )

    def test_tool_trace_is_metadata_only_and_privacy_guarded(self):
        run = self.make_run()
        entry = record_tool_call(
            run, tool='source_lookup', input_references=['source:1'], status='succeeded', retry_count=1,
        )
        self.assertNotIn('prompt', str(entry).lower())
        run.tool_calls = [{'tool': 'mail', 'inputReferences': ['person@example.edu'], 'status': 'failed'}]
        with self.assertRaises(ValidationError):
            run.save()

    def test_metrics_report_success_p95_cost_cache_and_fallback(self):
        self.make_run(latency=10, cost=10)
        self.make_run(latency=200, cost=20, cache_hit=True)
        self.make_run(status='fallback', latency=50, cost=0)
        row = agent_metrics(self.workspace)[0]
        self.assertEqual(row['successRate'], 1)
        self.assertEqual(row['p95LatencyMs'], 200)
        self.assertEqual(row['costMicrousd'], 30)
        self.assertEqual(row['cacheHits'], 1)
        self.assertEqual(row['fallbacks'], 1)

    def test_daily_budget_fails_over_before_overspend(self):
        DailyAgentBudget.objects.create(
            workspace=self.workspace, date=timezone.localdate(self.now), limit_microusd=100,
        )
        self.assertTrue(claim_daily_budget(self.workspace, estimated_cost_microusd=80, now=self.now)['allowed'])
        denied = claim_daily_budget(self.workspace, estimated_cost_microusd=21, now=self.now)
        self.assertFalse(denied['allowed'])
        self.assertTrue(denied['fallback'])

    def test_fake_clock_alerts_silence_no_new_and_duplicate_rate(self):
        connector = SourceConnector.objects.create(
            workspace=self.workspace, name='Fixture', platform='campus', status='active', owner='ops',
        )
        for index in range(3):
            IngestionRun.objects.create(
                connector=connector, status='succeeded', collected_count=10,
                new_count=0, duplicate_count=10, finished_at=self.now - timedelta(hours=index),
            )
        alerts = evaluate_ingestion_alerts(self.workspace, now=self.now)
        self.assertEqual({item.alert_type for item in alerts}, {
            'consecutive_no_new_items', 'abnormal_duplicate_rate',
        })
        silent_now = self.now + timedelta(hours=30)
        alerts = evaluate_ingestion_alerts(self.workspace, now=silent_now)
        self.assertIn('silent_ingestion', {item.alert_type for item in alerts})

    def test_feedback_is_audited_but_never_automatically_trains(self):
        run = self.make_run()
        client = APIClient()
        response = client.post(
            f'/api/admin/agent-runs/{run.run_id}/feedback/',
            {'input_version': 'v1', 'revision': {'decisionStatus': 'unknown'}, 'reasonCodes': ['human_edit']},
            format='json',
            HTTP_X_CLAWTREE_WORKSPACE=self.workspace.slug,
            HTTP_X_CLAWTREE_OPERATOR='reviewer',
            HTTP_IDEMPOTENCY_KEY='feedback-1',
        )
        self.assertEqual(response.status_code, 200, response.content)
        run.refresh_from_db()
        self.assertFalse(run.human_feedback['trainingEligible'])
        self.assertEqual(run.human_feedback['trainingStatus'], 'not_reviewed')
        self.assertFalse(response.json()['data']['automaticTraining'])
