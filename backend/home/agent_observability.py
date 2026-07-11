"""Privacy-safe AgentRun metrics, budgets, tool traces, and ingestion alerts."""
import math
from datetime import timedelta

from django.db import transaction
from django.db.models import Avg, Count, Sum
from django.utils import timezone

from .models import AgentAlert, AgentRun, DailyAgentBudget, IngestionRun


def record_tool_call(run, *, tool, input_references, status, retry_count=0, error_code=''):
    """Append metadata only. Prompts, bodies, addresses and chain-of-thought are forbidden."""
    entry = {
        'tool': str(tool)[:80],
        'inputReferences': list(input_references),
        'status': status,
        'retryCount': max(0, int(retry_count)),
        'errorCode': str(error_code)[:120],
    }
    run.tool_calls = [*(run.tool_calls or []), entry]
    run.save(update_fields=['tool_calls'])
    return entry


def claim_daily_budget(workspace, *, estimated_cost_microusd=0, now=None):
    now = now or timezone.now()
    with transaction.atomic():
        budget, _ = DailyAgentBudget.objects.select_for_update().get_or_create(
            workspace=workspace,
            date=timezone.localdate(now),
            defaults={'limit_microusd': 0, 'request_limit': 0},
        )
        projected_cost = budget.spent_microusd + max(0, int(estimated_cost_microusd))
        exceeded = bool(
            budget.fallback_only
            or (budget.limit_microusd and projected_cost > budget.limit_microusd)
            or (budget.request_limit and budget.request_count + 1 > budget.request_limit)
        )
        if exceeded:
            budget.fallback_only = True
            budget.save(update_fields=['fallback_only', 'updated_at'])
            return {'allowed': False, 'fallback': True, 'reason': 'daily_budget_exceeded'}
        budget.request_count += 1
        budget.spent_microusd = projected_cost
        budget.save(update_fields=['request_count', 'spent_microusd', 'updated_at'])
        return {'allowed': True, 'fallback': False, 'reason': ''}


def reconcile_daily_budget(workspace, *, reserved_cost_microusd, actual_cost_microusd, now=None):
    """Replace a pre-call cost reservation with provider-reported actual cost."""
    now = now or timezone.now()
    with transaction.atomic():
        budget, _ = DailyAgentBudget.objects.select_for_update().get_or_create(
            workspace=workspace,
            date=timezone.localdate(now),
            defaults={'limit_microusd': 0, 'request_limit': 0},
        )
        reserved = max(0, int(reserved_cost_microusd))
        # Unknown provider pricing/usage keeps the conservative reservation;
        # it must never be silently converted to zero cost.
        if actual_cost_microusd is None:
            return budget
        actual = max(0, int(actual_cost_microusd))
        budget.spent_microusd = max(0, budget.spent_microusd - reserved + actual)
        if budget.limit_microusd and budget.spent_microusd >= budget.limit_microusd:
            budget.fallback_only = True
        budget.save(update_fields=['spent_microusd', 'fallback_only', 'updated_at'])
        return budget


def percentile95(values):
    values = sorted(int(value) for value in values)
    if not values:
        return 0
    return values[max(0, math.ceil(len(values) * .95) - 1)]


def agent_metrics(workspace, *, since=None):
    since = since or timezone.now() - timedelta(days=7)
    queryset = AgentRun.objects.filter(workspace=workspace, created_at__gte=since)
    rows = []
    for task in queryset.values_list('task_type', flat=True).distinct().order_by('task_type'):
        task_runs = queryset.filter(task_type=task)
        total = task_runs.count()
        successful = task_runs.filter(status__in=['succeeded', 'fallback']).count()
        latencies = list(task_runs.values_list('latency_ms', flat=True))
        aggregate = task_runs.aggregate(cost=Sum('cost_microusd'), tokens=Sum('input_tokens') + Sum('output_tokens'))
        rows.append({
            'task': task,
            'total': total,
            'successRate': round(successful / total, 4) if total else 0,
            'p95LatencyMs': percentile95(latencies),
            'costMicrousd': aggregate['cost'] or 0,
            'tokens': aggregate['tokens'] or 0,
            'fallbacks': task_runs.filter(status='fallback').count(),
            'cacheHits': task_runs.filter(cache_hit=True).count(),
        })
    return rows


def _upsert_alert(workspace, key, alert_type, summary, evidence, *, connector=None, severity='warning', now=None):
    now = now or timezone.now()
    alert, created = AgentAlert.objects.get_or_create(
        workspace=workspace,
        alert_key=key,
        defaults={
            'alert_type': alert_type, 'summary': summary, 'evidence': evidence,
            'connector': connector, 'severity': severity, 'first_seen_at': now, 'last_seen_at': now,
        },
    )
    if not created:
        alert.occurrence_count += 1
        alert.last_seen_at = now
        alert.evidence = evidence
        alert.status = 'open'
        alert.save(update_fields=['occurrence_count', 'last_seen_at', 'evidence', 'status'])
    return alert


def evaluate_ingestion_alerts(workspace, *, now=None, silent_hours=26, zero_run_threshold=3):
    now = now or timezone.now()
    alerts = []
    connectors = workspace.source_connectors.filter(status='active')
    for connector in connectors:
        recent = list(IngestionRun.objects.filter(connector=connector).order_by('-created_at')[:10])
        latest = recent[0] if recent else None
        if not latest or latest.created_at < now - timedelta(hours=silent_hours):
            alerts.append(_upsert_alert(
                workspace, f'silent:{connector.id}', 'silent_ingestion',
                'Active connector has no recent ingestion heartbeat.',
                {'connectorId': connector.id, 'silentHours': silent_hours}, connector=connector, severity='critical', now=now,
            ))
        consecutive_zero = 0
        for run in recent:
            if run.status == 'succeeded' and run.new_count == 0:
                consecutive_zero += 1
            else:
                break
        if consecutive_zero >= zero_run_threshold:
            alerts.append(_upsert_alert(
                workspace, f'zero:{connector.id}', 'consecutive_no_new_items',
                'Connector produced no new items in consecutive successful runs.',
                {'connectorId': connector.id, 'consecutiveRuns': consecutive_zero}, connector=connector, now=now,
            ))
        for run in recent[:3]:
            if run.collected_count >= 5:
                ratio = run.duplicate_count / run.collected_count
                if ratio >= .9:
                    alerts.append(_upsert_alert(
                        workspace, f'duplicate:{connector.id}', 'abnormal_duplicate_rate',
                        'Connector duplicate rate exceeded the alert threshold.',
                        {'connectorId': connector.id, 'runId': run.id, 'duplicateRate': round(ratio, 4)},
                        connector=connector, now=now,
                    ))
                    break
    return alerts
