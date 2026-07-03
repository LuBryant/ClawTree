import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('..', import.meta.url);

async function read(path) {
  return readFile(new URL(path, root), 'utf8');
}

function exists(path) {
  return existsSync(new URL(path, root));
}

test('QA-7/QA-11 harness scripts are wired into package scripts', async () => {
  const pkg = JSON.parse(await read('package.json'));
  for (const script of ['docs:check', 'flight:test', 'harness:matrix', 'preflight']) {
    assert.ok(pkg.scripts[script], script);
  }
  assert.match(pkg.scripts.check, /docs:check/);
  assert.match(pkg.scripts.check, /harness:matrix/);
  assert.match(pkg.scripts.check, /flight:test/);
});

test('QA-6 smoke covers public APIs, outreach, approval, and proof', async () => {
  const smoke = await read('scripts/smoke.mjs');
  for (const expected of [
    '/api/health',
    '/api/demo',
    '/api/user/feed',
    '/api/user/events',
    '/api/user/recaps',
    '/api/outreach/draft',
    '/api/outreach/approve',
    '/api/proofs/anchor',
    'assertPublicPayload',
  ]) {
    assert.ok(smoke.includes(expected), expected);
  }
});

test('QA-8~QA-12 verification assets exist', async () => {
  for (const file of [
    'scripts/docs-check.mjs',
    'scripts/offline-golden-path.mjs',
    'scripts/harness-matrix.mjs',
    'scripts/preflight.mjs',
    'docs/harness-verification.md',
  ]) {
    assert.equal(exists(file), true, file);
  }
  const verification = await read('docs/harness-verification.md');
  for (const section of [
    'P0 工作包测试矩阵',
    'Offline / flight-mode acceptance',
    'Viewport acceptance checklist',
    'Reliability matrix',
    'Final freeze report',
  ]) {
    assert.ok(verification.includes(section), section);
  }
});
