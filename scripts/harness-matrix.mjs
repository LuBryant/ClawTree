import assert from 'node:assert/strict';
import { readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function read(relativePath) {
  return readFileSync(path.join(root, relativePath), 'utf8');
}

function exists(relativePath) {
  return statSync(path.join(root, relativePath)).isFile();
}

const failures = [];
function check(label, fn) {
  try {
    fn();
  } catch (error) {
    failures.push(label + ': ' + (error instanceof Error ? error.message : String(error)));
  }
}

const pkg = JSON.parse(read('package.json'));
const requiredScripts = ['install', 'dev', 'test', 'check', 'demo', 'smoke', 'docs:check', 'flight:test', 'harness:matrix', 'preflight'];
check('package scripts', () => {
  for (const script of requiredScripts) assert.ok(pkg.scripts[script], script);
});

const verification = read('docs/harness-verification.md');
for (const heading of [
  'P0 工作包测试矩阵',
  'Preflight command',
  'Offline / flight-mode acceptance',
  'Viewport acceptance checklist',
  'Reliability matrix',
  'Final freeze report',
]) {
  check('verification heading ' + heading, () => assert.ok(verification.includes('## ' + heading), heading));
}

for (const requiredFile of [
  'scripts/docs-check.mjs',
  'scripts/offline-golden-path.mjs',
  'scripts/harness-matrix.mjs',
  'scripts/preflight.mjs',
  'scripts/smoke.mjs',
  'tests/demo.test.mjs',
  'tests/frontend-routes.test.mjs',
  'tests/data-ai-contract.test.mjs',
  'tests/assistant-boundary.test.mjs',
  'tests/secret-scan.test.mjs',
]) {
  check('required file ' + requiredFile, () => assert.equal(exists(requiredFile), true));
}

const smoke = read('scripts/smoke.mjs');
for (const assertion of [
  '/api/health',
  '/api/demo',
  '/api/user/feed',
  '/api/user/events',
  '/api/user/recaps',
  '/api/outreach/draft',
  '/api/outreach/approve',
  '/api/proofs/anchor',
  'externalSideEffect',
]) {
  check('smoke assertion ' + assertion, () => assert.ok(smoke.includes(assertion), assertion));
}

for (const viewport of ['390 px', '768 px', '1440 px']) {
  check('viewport row ' + viewport, () => assert.ok(verification.includes(viewport), viewport));
}

for (const mode of ['Duplicate input', 'Out-of-order approval', 'Restart / repeat', 'Timeout / provider failure', 'Rate limit / budget missing', 'Half-success external system']) {
  check('reliability row ' + mode, () => assert.ok(verification.includes(mode), mode));
}

if (failures.length > 0) {
  console.error('HARNESS MATRIX FAIL');
  for (const failure of failures) console.error('- ' + failure);
  process.exit(1);
}

console.log('HARNESS MATRIX PASS: scripts, smoke assertions, viewport checklist, reliability matrix');
