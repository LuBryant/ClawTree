import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { AgentBudgetLedger } from '../frontend/app/lib/agent-runtime.mjs';
import {
  assistantRepairInstruction,
  buildTargetedRepairRequest,
  verifyHighRiskAssistantAnswer,
  verifyHighRiskAgentResult,
} from '../frontend/app/lib/agent-verifier.mjs';
import { buildUntrustedAgentEnvelope } from '../frontend/app/lib/agent-safety.mjs';

const providerSource = await readFile(
  new URL('../frontend/app/lib/agent-provider.server.ts', import.meta.url),
  'utf8',
);
const assistantRouteSource = await readFile(
  new URL('../frontend/app/api/assistant/chat/route.ts', import.meta.url),
  'utf8',
);

test('AIX-05 budget reserves before calls, reconciles actual cost, and rejects overflow', () => {
  let now = Date.parse('2026-07-11T00:00:00Z');
  const ledger = new AgentBudgetLedger({ limitMicrousd: 100, now: () => now });
  const reservation = ledger.reserve(70, { task: 'proposal' });
  assert.ok(reservation);
  assert.equal(ledger.reserve(31), null);
  assert.equal(ledger.snapshot().reservedMicrousd, 70);
  assert.equal(ledger.reconcile(reservation, 42), true);
  assert.deepEqual(ledger.snapshot(), {
    date: '2026-07-11',
    limitMicrousd: 100,
    spentMicrousd: 42,
    reservedMicrousd: 0,
    remainingMicrousd: 58,
  });
  assert.equal(ledger.reserve(59), null);
  now = Date.parse('2026-07-12T00:00:00Z');
  assert.ok(ledger.reserve(100));
  assert.equal(ledger.snapshot().spentMicrousd, 0);
  assert.equal(ledger.snapshot().date, '2026-07-12');
});

test('AIX-06 verifier rejects promises, privacy, stale registration claims, and alien citations', () => {
  const request = {
    task: 'proposal',
    input: {
      sourceIds: ['official-event'],
      event: { registrationDeadline: '2026-01-01T00:00:00Z' },
    },
  };
  const result = {
    tiers: [{ value: '保证获得奖金，立即报名', resources: ['联系 13800138000'] }],
    evidence: [{ claimId: 'proposal_basis', claim: '依据', sourceIds: ['model-invented'] }],
  };
  const verdict = verifyHighRiskAgentResult({
    request,
    result,
    now: Date.parse('2026-07-11T00:00:00Z'),
  });
  assert.equal(verdict.safe, false);
  assert.deepEqual(new Set(verdict.reasonCodes), new Set([
    'FORBIDDEN_COMMITMENT',
    'PRIVACY_DISCLOSURE',
    'DATE_INCONSISTENCY',
    'UNSUPPORTED_CITATION',
  ]));
});

test('AIX-06 targeted repair directive reaches the trusted provider envelope', () => {
  const request = buildTargetedRepairRequest({
    task: 'proposal',
    input: { text: 'source data', sourceIds: ['source-1'] },
  }, ['FORBIDDEN_COMMITMENT']);
  const envelope = buildUntrustedAgentEnvelope(request, { type: 'object' });
  assert.equal(envelope.trustedControl.verifierRepair.attempt, 1);
  assert.deepEqual(envelope.trustedControl.verifierRepair.reasonCodes, ['FORBIDDEN_COMMITMENT']);
  assert.equal(envelope.untrustedSourceData.verifierRepair, undefined);
});

test('AIX-06 assistant verifier rejects unsupported resources and stale registration without guarantee wording', () => {
  const verdict = verifyHighRiskAssistantAnswer({
    answer: '本活动提供 100 万元奖金，目前报名仍开放。',
    groundingContext: '经审核信息仅确认活动主题和主办方。',
    registrationState: 'closed',
  });
  assert.equal(verdict.safe, false);
  assert.ok(verdict.reasonCodes.includes('UNSUPPORTED_HIGH_RISK_CLAIM:奖金'));
  assert.ok(verdict.reasonCodes.includes('DATE_INCONSISTENCY'));
  assert.match(assistantRepairInstruction(verdict.reasonCodes), /仅重写一次/);
  assert.match(assistantRouteSource, /repairAttempts = 1/);
  assert.match(assistantRouteSource, /status: 'failed_closed'/);
});

test('AIX-06 targeted repair is exactly one scoped attempt and executor fails closed afterward', () => {
  const repaired = buildTargetedRepairRequest(
    { task: 'proposal', input: { text: 'draft', sourceIds: ['source-a'] } },
    ['FORBIDDEN_COMMITMENT'],
  );
  assert.equal(repaired.input.verifierRepair.attempt, 1);
  assert.deepEqual(repaired.input.verifierRepair.reasonCodes, ['FORBIDDEN_COMMITMENT']);
  assert.match(providerSource, /let repairAttempts: 0 \| 1 = 0/);
  assert.match(providerSource, /repairAttempts = 1/);
  assert.match(providerSource, /buildUnknownAgentResult\(safeRequest, `verifier_failed:/);
  assert.doesNotMatch(providerSource, /repairAttempts = 2/);
});

test('AIX-05 provider usage adapter rejects missing usage instead of inventing zero model cost', () => {
  assert.match(providerSource, /throw new Error\('provider_missing_usage'\)/);
  assert.match(providerSource, /prompt_tokens/);
  assert.match(providerSource, /completion_tokens/);
  assert.match(providerSource, /x-request-id/);
});
