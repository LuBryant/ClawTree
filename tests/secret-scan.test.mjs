import assert from 'node:assert/strict';
import test from 'node:test';
import { addedLinesFromDiff, scanText } from '../scripts/secret-scan.mjs';

test('secret scanner detects representative credentials without echoing values', () => {
  const providerKey = ['sk', 'fixture0123456789abcdefghijkl'].join('-');
  const databaseUrl = ['mysql://demo', 'fixture-password@db.invalid/app'].join(':');
  const findings = scanText(`const value = "${providerKey}";\nDATABASE_URL="${databaseUrl}"`);
  assert.deepEqual(findings.map((finding) => finding.rule).sort(), [
    'credential-url',
    'provider-api-key',
  ]);
  assert.equal(JSON.stringify(findings).includes(providerKey), false);
});

test('secret scanner accepts empty and environment-backed configuration', () => {
  const safe = `DEEPSEEK_API_KEY=\nSECRET_KEY = os.environ.get('DJANGO_SECRET_KEY')`;
  assert.deepEqual(scanText(safe), []);
});

test('git diff scanner considers additions but ignores removed leaked values', () => {
  const removed = ['sk', 'removed0123456789abcdefghijkl'].join('-');
  const diff = `--- a/client.ts\n+++ b/client.ts\n@@ -1 +1 @@\n-const key = '${removed}'\n+const key = process.env.API_KEY`;
  assert.equal(addedLinesFromDiff(diff), 'const key = process.env.API_KEY');
});
