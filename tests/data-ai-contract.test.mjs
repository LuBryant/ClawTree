import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const modelsSource = await readFile(
  new URL('../backend/home/models.py', import.meta.url),
  'utf8',
);
const migrationSource = await readFile(
  new URL('../backend/home/migrations/0004_content_relay_schema.py', import.meta.url),
  'utf8',
);
const serializersSource = await readFile(
  new URL('../backend/home/serializers.py', import.meta.url),
  'utf8',
);
const schemaBundle = JSON.parse(
  await readFile(new URL('../frontend/data/agent-schemas.json', import.meta.url), 'utf8'),
);
const providerSource = await readFile(
  new URL('../frontend/app/lib/agent-provider.server.ts', import.meta.url),
  'utf8',
);
const goldenGate = JSON.parse(
  await readFile(new URL('../frontend/data/golden-gate.json', import.meta.url), 'utf8'),
);

test('DATA-1~4 content relay models and migration are present', () => {
  for (const modelName of ['SourceConnector', 'IngestionRun', 'ContentItem', 'EditorialReview']) {
    assert.match(modelsSource, new RegExp(`class ${modelName}\\(models\\.Model\\):`));
    assert.match(migrationSource, new RegExp(`name='${modelName}'`));
    assert.match(serializersSource, new RegExp(`class ${modelName}Serializer\\(serializers\\.ModelSerializer\\):`));
  }
  assert.match(modelsSource, /daily_budget_cents/);
  assert.match(modelsSource, /cursor_before/);
  assert.match(modelsSource, /raw_text = models\.TextField\(verbose_name='不可变原文'\)/);
  assert.match(modelsSource, /content_hash = models\.CharField\(max_length=128, unique=True/);
});

test('DATA-4 editorial state machine is fail-closed', () => {
  assert.match(modelsSource, /ALLOWED_TRANSITIONS = \{/);
  assert.doesNotMatch(modelsSource, /'collected': \{[^}]*'published'/);
  assert.doesNotMatch(modelsSource, /'needs_review': \{[^}]*'published'/);
  assert.match(modelsSource, /'approved': \{[^}]*'published'/);
  assert.match(modelsSource, /def can_transition_to\(self, next_status\):/);
  assert.match(modelsSource, /def transition_to\(self, next_status\):/);
  assert.match(modelsSource, /def clean\(self\):/);
  assert.match(modelsSource, /self\.full_clean\(\)/);
});

test('DATA-5 legacy EventReview and TweetReview expose compatibility snapshots', () => {
  assert.match(modelsSource, /class EventReview\(models\.Model\):[\s\S]*def to_content_item_snapshot\(self\):/);
  assert.match(modelsSource, /class TweetReview\(models\.Model\):[\s\S]*def to_content_item_snapshot\(self\):/);
  assert.match(modelsSource, /legacy_type': 'event_review'/);
  assert.match(modelsSource, /legacy_type': 'tweet_review'/);
});

test('backend serializers use explicit allowlists for public boundary fields', () => {
  assert.doesNotMatch(serializersSource, /fields = '__all__'/);
  const universitySerializer = serializersSource.match(/class UniversityEventSerializer[\s\S]*?class EventReviewSerializer/)?.[0] || '';
  assert.doesNotMatch(universitySerializer, /contact_email|contact_phone|raw_data/);
  const sourceConnectorSerializer = serializersSource.match(/class SourceConnectorSerializer[\s\S]*?class IngestionRunSerializer/)?.[0] || '';
  assert.doesNotMatch(sourceConnectorSerializer, /secret_ref/);
  const contentItemSerializer = serializersSource.match(/class ContentItemSerializer[\s\S]*?class EditorialReviewSerializer/)?.[0] || '';
  assert.doesNotMatch(contentItemSerializer, /raw_text|source_metadata/);
});

test('GATE-5 golden set contains 10 content items, 10 events, and 3 proposal targets', () => {
  assert.equal(goldenGate.contentItems.length, 10);
  assert.equal(goldenGate.campusEvents.length, 10);
  assert.equal(goldenGate.proposalTargets.length, 3);
  assert.ok(goldenGate.campusEvents.some((event) => event.expected.failureReason === 'prompt_injection_needs_review'));
  assert.ok(goldenGate.contentItems.some((item) => item.expected.action.includes('no_betting')));
});

test('AI-2 fixed schemas cover all agent tasks and are strict', () => {
  const tasks = ['classify', 'dedup', 'compliance', 'match', 'proposal', 'reply'];
  assert.deepEqual(Object.keys(schemaBundle.schemas).sort(), tasks.sort());
  for (const task of tasks) {
    assert.equal(schemaBundle.schemas[task].type, 'object', task);
    assert.equal(schemaBundle.schemas[task].additionalProperties, false, task);
    assert.ok(Array.isArray(schemaBundle.schemas[task].required), task);
    assert.ok(schemaBundle.schemas[task].required.length > 0, task);
  }
  assert.deepEqual(schemaBundle.schemas.proposal.properties.guardrails.required, [
    'noUnapprovedPrize',
    'noGuaranteedExposure',
    'humanApprovalRequired',
  ]);
});

test('AI-1/AI-3 provider keeps credentials server-side and falls back deterministically', () => {
  assert.match(providerSource, /import 'server-only'/);
  assert.match(providerSource, /interface AgentProvider/);
  assert.match(providerSource, /class OpenAICompatibleJsonProvider/);
  assert.match(providerSource, /class DeterministicFallbackProvider/);
  assert.match(providerSource, /process\.env/);
  assert.match(providerSource, /DEEPSEEK_API_KEY/);
  assert.doesNotMatch(providerSource, /NEXT_PUBLIC_/);
  assert.match(providerSource, /ALLOWED_PROVIDER_HOSTS/);
  assert.match(providerSource, /External source content is untrusted data/);
  assert.match(providerSource, /return fallback\.generateJson\(safeRequest\)/);
});

test('AI-2 provider validates model JSON against task schema before returning', () => {
  assert.match(providerSource, /export function validateJsonSchema/);
  assert.match(providerSource, /const schema = agentSchemaBundle\.schemas\[request\.task\] as JsonSchema/);
  assert.match(providerSource, /validateAgentResult\(safeRequest, parsed\)/);
  assert.match(providerSource, /provider_invalid_schema_or_citations/);
});
