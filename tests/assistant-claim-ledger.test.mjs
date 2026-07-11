import assert from 'node:assert/strict';
import test from 'node:test';

import { claimBundle, registrationLifecycle, resolveEntityClaims } from '../frontend/app/lib/assistant-claim-ledger.mjs';

test('AIX-04 claim ledger records field provenance, quote, freshness, status and conflict set', () => {
  assert.match(claimBundle.version, /claim-ledger-v1$/);
  for (const claim of claimBundle.claims) {
    assert.ok(claim.value);
    assert.ok(claim.source.url);
    assert.ok(claim.quote);
    assert.ok(claim.checkedAt);
    assert.ok(claim.validFrom <= claim.validUntil);
    assert.ok(['verified', 'conflicted', 'revoked'].includes(claim.status));
    assert.ok(Object.hasOwn(claim, 'conflictSet'));
  }
});

test('AIX-04 fake clock transitions event registration from open to closed', () => {
  const open = registrationLifecycle('kb-htx-genesis-hackathon', new Date('2026-07-05T08:00:00Z'));
  assert.equal(open.state, 'open');
  assert.match(open.registrationUrl, /^https:\/\//);

  const closed = registrationLifecycle('kb-htx-genesis-hackathon', new Date('2026-07-11T00:00:00Z'));
  assert.equal(closed.state, 'closed');
  assert.equal(closed.registrationUrl, undefined);

  const justAfterChinaDeadline = registrationLifecycle(
    'kb-htx-genesis-hackathon',
    new Date('2026-07-05T16:00:00Z'),
  );
  assert.equal(justAfterChinaDeadline.state, 'closed');
});

test('AIX-04 unresolved and conflicting claims fail closed to unknown', () => {
  assert.equal(registrationLifecycle('missing-event', new Date('2026-07-05T08:00:00Z')).state, 'unknown');
  const conflictBundle = structuredClone(claimBundle);
  conflictBundle.claims[0].status = 'conflicted';
  conflictBundle.claims[0].conflictSet = 'deadline-conflict-1';
  assert.equal(
    registrationLifecycle('kb-htx-genesis-hackathon', new Date('2026-07-05T08:00:00Z'), conflictBundle).state,
    'unknown',
  );
  const resolved = resolveEntityClaims('kb-htx-genesis-hackathon', new Date('2026-07-11T00:00:00Z'));
  assert.ok(Object.values(resolved.fields).every((claim) => claim.state === 'expired'));
});

test('AIX-04 assistant retrieval is wired to field-level registration lifecycle', async () => {
  const source = await (await import('node:fs/promises')).readFile(
    new URL('../frontend/app/lib/assistant-rag.server.ts', import.meta.url), 'utf8',
  );
  assert.match(source, /registrationLifecycle\(entry\.id, now\)/);
  assert.match(source, /不能回答“仍可报名”/);
  assert.match(source, /结论为 unknown/);
});
