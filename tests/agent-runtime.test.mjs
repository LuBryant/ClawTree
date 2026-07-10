import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import {
  AgentResultCache,
  createAgentCacheIdentity,
} from '../frontend/app/lib/agent-result-cache.mjs';

const schemas = JSON.parse(await readFile(
  new URL('../frontend/data/agent-schemas.json', import.meta.url),
  'utf8',
));
const providerSource = await readFile(
  new URL('../frontend/app/lib/agent-provider.server.ts', import.meta.url),
  'utf8',
);

test('AI-6 cache identity is stable and isolates schema/model versions', () => {
  const left = createAgentCacheIdentity({
    request: { task: 'classify', input: { text: 'campus AI', sourceIds: ['source-a'] } },
    schemaVersion: 'schema-v1',
    modelVersion: 'model-v1',
  });
  const reordered = createAgentCacheIdentity({
    request: { input: { sourceIds: ['source-a'], text: 'campus AI' }, task: 'classify' },
    schemaVersion: 'schema-v1',
    modelVersion: 'model-v1',
  });
  assert.equal(left.inputContentHash, reordered.inputContentHash);
  assert.equal(left.cacheKey, reordered.cacheKey);
  assert.notEqual(left.cacheKey, createAgentCacheIdentity({
    request: { task: 'classify', input: { text: 'campus AI', sourceIds: ['source-a'] } },
    schemaVersion: 'schema-v2',
    modelVersion: 'model-v1',
  }).cacheKey);
  assert.notEqual(left.cacheKey, createAgentCacheIdentity({
    request: { task: 'classify', input: { text: 'campus AI', sourceIds: ['source-a'] } },
    schemaVersion: 'schema-v1',
    modelVersion: 'model-v2',
  }).cacheKey);
  const otherTask = createAgentCacheIdentity({
    request: { task: 'compliance', input: { text: 'campus AI', sourceIds: ['source-a'] } },
    schemaVersion: 'schema-v1',
    modelVersion: 'model-v1',
  });
  assert.equal(left.inputContentHash, otherTask.inputContentHash);
  assert.notEqual(left.cacheKey, otherTask.cacheKey);
});

test('AI-6 repeated and concurrent calls compute once and return defensive copies', async () => {
  const cache = new AgentResultCache();
  let providerCalls = 0;
  const compute = async () => {
    providerCalls += 1;
    await Promise.resolve();
    return { decisionStatus: 'known', labels: ['campus'], costMicrousd: 120 };
  };
  const [first, concurrent] = await Promise.all([
    cache.getOrCompute('same-key', compute),
    cache.getOrCompute('same-key', compute),
  ]);
  const repeated = await cache.getOrCompute('same-key', compute);
  assert.equal(providerCalls, 1);
  assert.equal(first.cacheHit, false);
  assert.equal(concurrent.cacheHit, true);
  assert.equal(repeated.cacheHit, true);
  repeated.value.labels.push('mutated');
  assert.deepEqual((await cache.getOrCompute('same-key', compute)).value.labels, ['campus']);
});

test('AI-6 execution trace makes cache-hit incremental usage and cost zero', () => {
  assert.match(providerSource, /incrementalInputTokens: execution\.cacheHit \? 0 : null/);
  assert.match(providerSource, /incrementalOutputTokens: execution\.cacheHit \? 0 : null/);
  assert.match(providerSource, /incrementalCostMicrousd: execution\.cacheHit \? 0 : null/);
  assert.match(providerSource, /agentSchemaBundle\.version/);
  assert.match(providerSource, /provider\.modelVersion/);
});

test('AI-9 every task has an explicit known/unknown decision state', () => {
  for (const [task, schema] of Object.entries(schemas.schemas)) {
    assert.ok(schema.required.includes('decisionStatus'), task);
    assert.deepEqual(schema.properties.decisionStatus.enum, ['known', 'unknown'], task);
  }
  assert.ok(schemas.schemas.classify.properties.labels.items.enum.includes('unknown'));
  assert.ok(schemas.schemas.compliance.properties.riskLevel.enum.includes('unknown'));
  assert.deepEqual(schemas.schemas.dedup.properties.isDuplicate.type, ['boolean', 'null']);
  assert.deepEqual(schemas.schemas.match.properties.score.type, ['integer', 'null']);
  assert.deepEqual(schemas.schemas.proposal.properties.tiers.type, ['array', 'null']);
});

test('AI-9 failure and low confidence paths fail closed without a forced answer', () => {
  assert.match(providerSource, /LOW_CONFIDENCE_THRESHOLD = 0\.65/);
  assert.match(providerSource, /buildUnknownAgentResult\(safeRequest, 'provider_failure'\)/);
  assert.match(providerSource, /buildUnknownAgentResult\(safeRequest, reason\)/);
  assert.match(providerSource, /decisionStatus: 'unknown'/);
  assert.match(providerSource, /needsReview: true/);
  assert.match(providerSource, /intent: 'unknown'/);
  assert.match(providerSource, /tiers: null/);
  assert.match(providerSource, /score: null/);
});
