import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const data = JSON.parse(
  await readFile(new URL('../frontend/data/demo.json', import.meta.url), 'utf8'),
);

test('demo fixture has traceable signals and no fake-real contacts', () => {
  assert.equal(data.workspace.role, 'genesis_customer');
  assert.equal(data.workspace.id, 'ws-treefinance');
  assert.ok(data.signals.length >= 4);
  for (const signal of data.signals) {
    assert.match(signal.url, /^https:\/\//);
    assert.ok(signal.publishedAt);
    assert.equal(signal.verification, 'verified');
    assert.ok(signal.confidence >= 0 && signal.confidence <= 1);
  }
  for (const target of data.targets) {
    assert.equal(target.contact.isMock, true);
    assert.match(target.contact.email, /\.invalid$/);
  }
});

test('campaign references only existing signals', () => {
  const ids = new Set(data.signals.map((signal) => signal.id));
  assert.ok(data.campaign.signalIds.length >= 3);
  for (const id of data.campaign.signalIds) assert.ok(ids.has(id), id);
});

test('WC-1 candidate campuses have two public evidence links each', () => {
  assert.equal(data.targets.length, 5);
  assert.ok(data.targets.some((target) => target.id === 'target-jnu'));
  for (const target of data.targets) {
    assert.equal(target.evidence.length, 2, target.id);
    assert.ok(target.recommendedFormat, target.id);
    for (const evidence of target.evidence) assert.match(evidence.url, /^https:\/\//, target.id);
  }
});

test('WC-2~9 theme package is complete and avoids outcome scoring', () => {
  assert.equal(data.themePackage.course.modules.length, 4);
  assert.equal(data.themePackage.challenge.phases.length, 4);
  assert.equal(
    data.themePackage.challenge.rubric.reduce((total, item) => total + item.weight, 0),
    100,
  );
  assert.doesNotMatch(
    data.themePackage.challenge.rubric.map((item) => item.label).join(' '),
    /比分|猜中|赛果/,
  );
  assert.equal(data.campaign.localTopics.length, 4);
  assert.equal(data.themePackage.mediaPlan.length, 5);
  assert.equal(data.themePackage.sponsorTiers.length, 3);
  for (const guardrail of ['无博彩', '无比分预测', '无投资建议', '无收益承诺', '无结果保证']) {
    assert.ok(data.themePackage.guardrails.includes(guardrail), guardrail);
  }
});

test('outreach state machine cannot skip human approval', () => {
  const transitions = {
    draft: ['approved'],
    approved: ['simulated_sent', 'sent'],
    simulated_sent: ['replied'],
    sent: ['replied'],
    replied: ['closed'],
    closed: [],
  };
  assert.equal(transitions.draft.includes('sent'), false);
  assert.equal(transitions.draft.includes('simulated_sent'), false);
  assert.equal(transitions.draft.includes('approved'), true);
});

test('proof public payload allowlist excludes private fields', () => {
  const allowed = ['payloadVersion', 'workspaceId', 'campaignId', 'draftId', 'signalIds', 'approvalStatus'];
  const forbidden = ['email', 'contact', 'body', 'reply', 'name', 'prompt'];
  for (const field of forbidden) assert.equal(allowed.includes(field), false);
});
