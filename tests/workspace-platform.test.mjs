import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('..', import.meta.url);
const read = (path) => readFile(new URL(path, root), 'utf8');

const workspaceConfig = await read('frontend/app/config/workspaces.ts');
const homePage = await read('frontend/app/page.tsx');
const assistantPrompt = await read('frontend/app/lib/assistant-prompt.server.ts');
const draftRoute = await read('frontend/app/api/outreach/draft/route.ts');
const proofRoute = await read('frontend/app/api/proofs/anchor/route.ts');
const models = await read('backend/home/models.py');
const migration = await read('backend/home/migrations/0005_workspace_platform.py');

test('platform identity is separate from the demo case', () => {
  assert.match(workspaceConfig, /AI Partnership Intelligence Network/);
  assert.match(workspaceConfig, /status: 'demo'/);
  assert.match(workspaceConfig, /status: 'sandbox'/);
  assert.match(homePage, /ClawTree 是平台，这里用大树财经高校行作为演示案例/);
  assert.doesNotMatch(homePage, /ClawTree 是大树财经的/);
});

test('workspace profile drives agents, outreach identity, and proof scope', () => {
  assert.match(assistantPrompt, /buildAssistantSystemPrompt\(workspace/);
  assert.match(assistantPrompt, /reference demo case, not the platform owner, a customer claim, or an onboarded workspace/);
  assert.match(draftRoute, /DEMO_WORKSPACE\.outreachSignature/);
  assert.match(draftRoute, /WORKSPACE_MISMATCH/);
  assert.match(proofRoute, /workspaceId/);
});

test('backend persists workspace isolation and reviewed capability evidence', () => {
  for (const model of ['Workspace', 'BrandProfile', 'Capability']) {
    assert.match(models, new RegExp(`class ${model}\\(models\\.Model\\):`));
    assert.match(migration, new RegExp(`name='${model}'`));
  }
  assert.match(models, /unique_workspace_event_source/);
  assert.match(models, /unique_workspace_content_hash/);
  assert.match(migration, /seed_treefinance_workspace/);
});
