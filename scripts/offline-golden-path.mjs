import assert from 'node:assert/strict';
import { readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function read(relativePath) {
  return readFileSync(path.join(root, relativePath), 'utf8');
}

const demo = JSON.parse(read('frontend/data/demo.json'));
const golden = JSON.parse(read('frontend/data/golden-gate.json'));

assert.equal(demo.meta.mode, 'mock');
assert.match(demo.meta.notice, /MOCK|mock|演示/);
for (const target of demo.targets) {
  assert.equal(target.contact.isMock, true, target.id);
  assert.match(target.contact.email, /\.invalid$/, target.id);
}

for (const signal of demo.signals) {
  assert.match(signal.url, /^https:\/\//, signal.id);
  assert.ok(signal.publishedAt, signal.id);
  assert.ok(signal.fetchedAt, signal.id);
  assert.equal(signal.verification, 'verified', signal.id);
}

assert.equal(golden.contentItems.length, 10);
assert.equal(golden.campusEvents.length, 10);
assert.equal(golden.proposalTargets.length, 3);

const routeChecks = [
  ['frontend/app/api/health/route.ts', /externalSideEffects: false/],
  ['frontend/app/api/demo/route.ts', /cache-control/],
  ['frontend/app/api/outreach/draft/route.ts', /externalSideEffect: false/],
  ['frontend/app/api/outreach/approve/route.ts', /externalSideEffect: false/],
  ['frontend/app/api/proofs/anchor/route.ts', /isMock: true/],
  ['frontend/app/api/user/feed/route.ts', /externalSideEffect: false/],
  ['frontend/app/api/user/events/route.ts', /externalSideEffect: false/],
  ['frontend/app/api/user/recaps/route.ts', /externalSideEffect: false/],
];

for (const [relativePath, pattern] of routeChecks) {
  const source = read(relativePath);
  assert.match(source, pattern, relativePath);
  assert.doesNotMatch(source, /process\.env\.(?:DEEPSEEK|MYSQL|DATABASE|TRON|DEPLOYER|PRIVATE)/, relativePath);
}

const proofRoute = read('frontend/app/api/proofs/anchor/route.ts');
for (const privateField of ['email', 'contact', 'body', 'reply', 'name', 'prompt']) {
  assert.doesNotMatch(proofRoute, new RegExp(privateField + "['\\\"]\\s*:"), privateField);
}

for (const relativePath of [
  'frontend/app/components/DemoConsole.tsx',
  'frontend/app/user/page.tsx',
  'frontend/app/admin/outreach/page.tsx',
]) {
  assert.equal(statSync(path.join(root, relativePath)).isFile(), true, relativePath);
}

console.log('OFFLINE GOLDEN PATH PASS: no key/db/wallet/network dependency required for fixture demo');
