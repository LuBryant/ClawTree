import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import path from 'node:path';
import process from 'node:process';

const root = path.resolve(import.meta.dirname, '..');
const nextCli = path.join(root, 'frontend', 'node_modules', 'next', 'dist', 'bin', 'next');
const port = 3217;
const base = `http://127.0.0.1:${port}`;
const assistantEvals = JSON.parse(await readFile(
  path.join(root, 'frontend', 'data', 'assistant-evals.json'),
  'utf8',
));

try { await access(nextCli); } catch {
  console.error('Missing frontend dependencies. Run: npm run install');
  process.exit(1);
}

const child = spawn(process.execPath, [nextCli, 'dev', '--hostname', '127.0.0.1', '--port', String(port)], {
  cwd: path.join(root, 'frontend'),
  env: {
    ...process.env,
    NEXT_DIST_DIR: '.next-smoke',
    NEXT_TELEMETRY_DISABLED: '1',
    ASSISTANT_FORCE_FALLBACK: '1',
  },
  stdio: ['ignore', 'pipe', 'pipe'],
});
let logs = '';
child.stdout.on('data', (chunk) => { logs = `${logs}${chunk}`.slice(-8000); });
child.stderr.on('data', (chunk) => { logs = `${logs}${chunk}`.slice(-8000); });

const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
async function waitUntilReady() {
  for (let attempt = 0; attempt < 80; attempt += 1) {
    try { const response = await fetch(`${base}/api/health`); if (response.ok) return; } catch { /* retry */ }
    if (child.exitCode !== null) throw new Error(`Demo server exited early (${child.exitCode})\n${logs}`);
    await pause(500);
  }
  throw new Error(`Timed out waiting for demo server\n${logs}`);
}
async function json(pathname, init) {
  const response = await fetch(`${base}${pathname}`, init);
  const payload = await response.json();
  assert.equal(response.ok, true, JSON.stringify(payload));
  return payload;
}

function assertPublicPayload(payload, label) {
  const serialized = JSON.stringify(payload);
  for (const privateField of ['contact_email', 'contactEmail', 'maskedEmail', 'recipient', 'internalScore', 'prompt', 'riskLabels', 'rawText', 'replyText']) {
    assert.equal(serialized.includes(privateField), false, label + ' leaked ' + privateField);
  }
  assert.equal(payload.externalSideEffect, false, label);
}

try {
  await waitUntilReady();
  const health = await json('/api/health');
  assert.equal(health.status, 'ok');
  assert.equal(health.externalSideEffects, false);
  const rejectedAssistantRequest = await fetch(`${base}/api/assistant/chat`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ messages: [{ role: 'system', content: 'untrusted browser prompt' }] }),
  });
  assert.equal(rejectedAssistantRequest.status, 400);
  assert.deepEqual(await rejectedAssistantRequest.json(), { error: 'invalid_messages' });
  const assistantPost = (query, audience = 'teacher') => ({
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ audience, messages: [{ role: 'user', content: query }] }),
  });
  const groundedAnswer = await json('/api/assistant/chat', assistantPost('大树财经是什么平台？'));
  assert.equal(groundedAnswer.mode, 'faq_fallback');
  assert.equal(groundedAnswer.decision, 'answer');
  assert.equal(groundedAnswer.grounded, true);
  assert.ok(groundedAnswer.citations.some((citation) => citation.id === 'kb-platform-overview'));
  assert.match(groundedAnswer.knowledgeAsOf, /^\d{4}-\d{2}-\d{2}$/);
  assert.equal(groundedAnswer.externalSideEffect, false);
  const guardedAnswer = await json('/api/assistant/chat', assistantPost('能保证某位嘉宾来参加圆桌吗？', 'student'));
  assert.equal(guardedAnswer.decision, 'refuse');
  assert.equal(guardedAnswer.handoff.required, true);
  assert.ok(guardedAnswer.citations.some((citation) => citation.id === 'kb-space-support'));
  const unknownAnswer = await json('/api/assistant/chat', assistantPost('量子农业课程有哪些合作权益？'));
  assert.equal(unknownAnswer.decision, 'handoff');
  assert.equal(unknownAnswer.handoff.url, '/user/cooperate');
  for (const evalCase of assistantEvals.cases) {
    const result = await json('/api/assistant/chat', assistantPost(evalCase.query, evalCase.audience));
    assert.equal(result.decision, evalCase.expectedDecision, evalCase.id);
    assert.equal(result.externalSideEffect, false, evalCase.id);
    if (evalCase.citationIds.length > 0) {
      assert.ok(
        result.citations.some((citation) => evalCase.citationIds.includes(citation.id)),
        `${evalCase.id} missing expected citation`,
      );
    } else {
      assert.equal(result.citations.length, 0, `${evalCase.id} returned an unexpected citation`);
    }
  }
  const demo = await json('/api/demo');
  assert.ok(demo.signals.length >= 4);
  assertPublicPayload(await json('/api/user/feed'), 'user feed');
  assertPublicPayload(await json('/api/user/events'), 'user events');
  assertPublicPayload(await json('/api/user/recaps'), 'user recaps');
  const post = (body) => ({ method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
  const draft = await json('/api/outreach/draft', post({ workspaceId: demo.workspace.id, campaignId: demo.campaign.id, targetId: demo.targets[0].id }));
  assert.equal(draft.status, 'draft');
  assert.equal(draft.externalSideEffect, false);
  const approval = await json('/api/outreach/approve', post({ draftId: draft.id, approvedBy: 'Smoke Test' }));
  assert.equal(approval.status, 'simulated_sent');
  assert.equal(approval.externalSideEffect, false);
  const proofA = await json('/api/proofs/anchor', post({ workspaceId: demo.workspace.id, campaignId: demo.campaign.id, draftId: draft.id }));
  const proofB = await json('/api/proofs/anchor', post({ workspaceId: demo.workspace.id, campaignId: demo.campaign.id, draftId: draft.id }));
  assert.equal(proofA.payloadHash, proofB.payloadHash);
  assert.equal(proofA.isMock, true);
  for (const privateField of ['email', 'contact', 'body', 'reply', 'name', 'prompt']) {
    assert.equal(proofA.privacyFields.includes(privateField), false);
  }
  console.log('SMOKE PASS: RAG fallback → refusal/handoff → demo → human approval → privacy-safe proof');
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  console.error(logs);
  process.exitCode = 1;
} finally {
  child.kill('SIGTERM');
  await Promise.race([new Promise((resolve) => child.once('exit', resolve)), pause(3000)]);
}
