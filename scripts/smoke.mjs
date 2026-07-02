import assert from 'node:assert/strict';
import { access } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import path from 'node:path';
import process from 'node:process';

const root = path.resolve(import.meta.dirname, '..');
const nextCli = path.join(root, 'frontend', 'node_modules', 'next', 'dist', 'bin', 'next');
const port = 3217;
const base = `http://127.0.0.1:${port}`;

try { await access(nextCli); } catch {
  console.error('Missing frontend dependencies. Run: npm run install');
  process.exit(1);
}

const child = spawn(process.execPath, [nextCli, 'dev', '--hostname', '127.0.0.1', '--port', String(port)], {
  cwd: path.join(root, 'frontend'), env: { ...process.env, NEXT_TELEMETRY_DISABLED: '1' },
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

try {
  await waitUntilReady();
  const health = await json('/api/health');
  assert.equal(health.status, 'ok');
  assert.equal(health.externalSideEffects, false);
  const demo = await json('/api/demo');
  assert.ok(demo.signals.length >= 4);
  const post = (body) => ({ method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
  const draft = await json('/api/outreach/draft', post({ campaignId: demo.campaign.id, targetId: demo.targets[0].id }));
  assert.equal(draft.status, 'draft');
  assert.equal(draft.externalSideEffect, false);
  const approval = await json('/api/outreach/approve', post({ draftId: draft.id, approvedBy: 'Smoke Test' }));
  assert.equal(approval.status, 'simulated_sent');
  assert.equal(approval.externalSideEffect, false);
  const proofA = await json('/api/proofs/anchor', post({ campaignId: demo.campaign.id, draftId: draft.id }));
  const proofB = await json('/api/proofs/anchor', post({ campaignId: demo.campaign.id, draftId: draft.id }));
  assert.equal(proofA.payloadHash, proofB.payloadHash);
  assert.equal(proofA.isMock, true);
  for (const privateField of ['email', 'contact', 'body', 'reply', 'name', 'prompt']) {
    assert.equal(proofA.privacyFields.includes(privateField), false);
  }
  console.log('SMOKE PASS: health → demo → draft → human approval → privacy-safe proof');
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  console.error(logs);
  process.exitCode = 1;
} finally {
  child.kill('SIGTERM');
  await Promise.race([new Promise((resolve) => child.once('exit', resolve)), pause(3000)]);
}
