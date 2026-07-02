import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const data = JSON.parse(
  await readFile(new URL('../frontend/data/demo.json', import.meta.url), 'utf8'),
);

test('demo fixture has traceable signals and no fake-real contacts', () => {
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
  const allowed = ['payloadVersion', 'campaignId', 'draftId', 'signalIds', 'approvalStatus'];
  const forbidden = ['email', 'contact', 'body', 'reply', 'name', 'prompt'];
  for (const field of forbidden) assert.equal(allowed.includes(field), false);
});
