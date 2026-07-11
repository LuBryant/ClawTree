import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { readFile, writeFile } from 'node:fs/promises';
import { rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import net from 'node:net';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const root = new URL('..', import.meta.url);

function exists(path) {
  return existsSync(new URL(path, root));
}

async function read(path) {
  return readFile(new URL(path, root), 'utf8');
}

async function freePort() {
  const server = net.createServer();
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const address = server.address();
  assert.ok(address && typeof address === 'object');
  const port = address.port;
  server.close();
  await once(server, 'close');
  return port;
}

async function waitForServer(url, child, output) {
  const deadline = Date.now() + 20_000;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) {
      throw new Error(`Next dev server exited with ${child.exitCode}\n${output()}`);
    }
    try {
      const response = await fetch(url);
      if (response.ok) return;
    } catch {
      // Server is still starting.
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`Timed out waiting for Next dev server\n${output()}`);
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

test('fixture events API applies UI filters, stable ordering, and safe pagination', { timeout: 30_000 }, async (t) => {
  const port = await freePort();
  const frontendRoot = fileURLToPath(new URL('../frontend/', import.meta.url));
  const tsconfigPath = new URL('../frontend/tsconfig.json', import.meta.url);
  const originalTsconfig = await readFile(tsconfigPath, 'utf8');
  const distDir = `.next-events-test-${port}`;
  let serverOutput = '';
  const child = spawn(
    process.execPath,
    ['node_modules/next/dist/bin/next', 'dev', '--hostname', '127.0.0.1', '--port', String(port)],
    {
      cwd: frontendRoot,
      env: { ...process.env, NEXT_DIST_DIR: distDir },
      stdio: ['ignore', 'pipe', 'pipe'],
    },
  );
  child.stdout.on('data', (chunk) => { serverOutput += chunk; });
  child.stderr.on('data', (chunk) => { serverOutput += chunk; });
  t.after(async () => {
    if (child.exitCode === null) {
      child.kill('SIGTERM');
      await once(child, 'exit');
    }
    await rm(new URL(`../frontend/${distDir}/`, import.meta.url), { recursive: true, force: true });
    await writeFile(tsconfigPath, originalTsconfig);
  });

  const base = `http://127.0.0.1:${port}`;
  await waitForServer(`${base}/api/health`, child, () => serverOutput);

  async function events(query = '') {
    const response = await fetch(`${base}/api/events${query}`);
    assert.equal(response.status, 200);
    return response.json();
  }

  const all = await events('?ordering=event_date');
  assert.deepEqual(all.results.map((item) => item.id), [4, 2, 3, 1]);
  assert.equal(all.count, 4);
  assert.equal(all.next, null);
  assert.equal(all.previous, null);

  const descending = await events('?ordering=-event_date');
  assert.deepEqual(descending.results.map((item) => item.id), [1, 2, 3, 4]);

  const web3 = await events('?category=Web3');
  assert.equal(web3.count, 1);
  assert.ok(web3.results.every((item) => item.category === 'Web3'));

  const hackathon = await events(`?event_type=${encodeURIComponent('黑客松')}`);
  assert.equal(hackathon.count, 1);
  assert.ok(hackathon.results.every((item) => item.event_type === '黑客松'));

  const searched = await events(`?search=${encodeURIComponent('广州高校行')}`);
  assert.equal(searched.count, 1);
  assert.equal(searched.results[0].id, 1);

  const secondPage = await events('?page=2&category=AI');
  assert.equal(secondPage.count, 2);
  assert.deepEqual(secondPage.results, []);
  assert.match(secondPage.previous, /[?&]page=1(?:&|$)/);

  for (const item of all.results) {
    assert.equal(item.has_public_contact, false);
    for (const privateField of ['contact_email', 'contact_ai_email', 'contact_phone', 'contact_wechat', 'contact_qq']) {
      assert.equal(Object.hasOwn(item, privateField), false, privateField);
    }
  }
});
