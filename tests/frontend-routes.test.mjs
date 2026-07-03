import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import test from 'node:test';

const root = new URL('..', import.meta.url);

function exists(path) {
  return existsSync(new URL(path, root));
}

async function read(path) {
  return readFile(new URL(path, root), 'utf8');
}

test('USER-1~7 public portal routes exist', () => {
  for (const path of [
    'frontend/app/user/page.tsx',
    'frontend/app/user/signals/page.tsx',
    'frontend/app/user/events/page.tsx',
    'frontend/app/user/recaps/page.tsx',
    'frontend/app/user/recaps/[id]/page.tsx',
    'frontend/app/user/about/page.tsx',
    'frontend/app/user/cooperate/page.tsx',
  ]) {
    assert.equal(exists(path), true, path);
  }
});

test('ADMIN-2~5 management routes exist', () => {
  for (const path of [
    'frontend/app/admin/content/page.tsx',
    'frontend/app/admin/ingestion/page.tsx',
    'frontend/app/admin/proposals/page.tsx',
    'frontend/app/admin/outreach/page.tsx',
  ]) {
    assert.equal(exists(path), true, path);
  }
});

test('public user API routes use allowlisted fields and hide private operational data', async () => {
  for (const path of [
    'frontend/app/api/user/feed/route.ts',
    'frontend/app/api/user/events/route.ts',
    'frontend/app/api/user/recaps/route.ts',
  ]) {
    const source = await read(path);
    assert.doesNotMatch(source, /contact_email|contactEmail|maskedEmail|recipient|internalScore|prompt|riskLabels|rawText|replyText/);
    assert.match(source, /externalSideEffect: false/);
    assert.match(source, /cache-control/);
  }
});

test('public-data keeps contact details masked outside admin/outreach fixtures', async () => {
  const source = await read('frontend/app/lib/public-data.ts');
  assert.match(source, /publicNote: '公开端不展示联系邮箱/);
  assert.match(source, /maskedEmail/);
  assert.doesNotMatch(source, /@gmail\.com|@qq\.com|@163\.com|@edu\.cn/);
});

test('legacy admin event browser has no real email side effects', async () => {
  const source = await read('frontend/app/admin/events/page.tsx');
  assert.doesNotMatch(source, /mail\.google\.com|bcc=|window\.open|@gmail\.com|批量发送邮件|发送邮件/);
  assert.match(source, /本页不会打开邮箱、不会发送、不会写外部系统/);
  assert.match(source, /每校仍是一封独立草稿/);
});

test('browser API client resolves same-origin URLs for write operations', async () => {
  const source = await read('frontend/app/lib/api-client.ts');
  assert.match(source, /function resolvedApiBase\(\)/);
  assert.match(source, /resolvedApiBase\(\).*path/s);
  assert.doesNotMatch(source, /\$\{API_BASE\}\$\{path\}/);
});
