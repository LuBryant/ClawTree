import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const knowledge = JSON.parse(await readFile(
  new URL('../frontend/data/assistant-knowledge.json', import.meta.url),
  'utf8',
));
const evals = JSON.parse(await readFile(
  new URL('../frontend/data/assistant-evals.json', import.meta.url),
  'utf8',
));
const ragSource = await readFile(
  new URL('../frontend/app/lib/assistant-rag.server.ts', import.meta.url),
  'utf8',
);
const routeSource = await readFile(
  new URL('../frontend/app/api/assistant/chat/route.ts', import.meta.url),
  'utf8',
);
const chatSource = await readFile(
  new URL('../frontend/app/components/ChatDialog.tsx', import.meta.url),
  'utf8',
);
const cooperateSource = await readFile(
  new URL('../frontend/app/user/cooperate/page.tsx', import.meta.url),
  'utf8',
);

test('CS-1 reviewed knowledge entries have owner, source, and validity', () => {
  assert.ok(knowledge.entries.length >= 10);
  const categories = new Set(knowledge.entries.map((entry) => entry.category));
  for (const category of ['platform', 'case', 'cooperation', 'capability', 'contact', 'boundary']) {
    assert.ok(categories.has(category), category);
  }
  for (const entry of knowledge.entries) {
    assert.equal(entry.approved, true, entry.id);
    assert.ok(entry.owner, entry.id);
    assert.match(entry.source.url, /^\//, entry.id);
    assert.match(entry.source.checkedAt, /^\d{4}-\d{2}-\d{2}$/, entry.id);
    assert.ok(entry.validFrom <= entry.validUntil, entry.id);
    assert.ok(entry.keywords.length >= 4, entry.id);
  }
});

test('CS-2/3 RAG enforces citations, expiry, conflicts, and handoff', () => {
  assert.match(ragSource, /entry\.validFrom <= today && entry\.validUntil >= today/);
  assert.match(ragSource, /stale_knowledge/);
  assert.match(ragSource, /conflicting_knowledge/);
  assert.match(ragSource, /unknown_question/);
  assert.match(ragSource, /citations: entries\.map\(toCitation\)/);
  assert.match(routeSource, /knowledgeAsOf/);
  assert.match(routeSource, /retrieveAssistantKnowledge/);
});

test('CS-4 policy blocks promises and prompt injection before model use', () => {
  for (const token of ['PROMPT_ATTACK', 'SECRET_REQUEST', 'GUARANTEE_WORDS', 'GUARANTEE_TARGETS']) {
    assert.match(ragSource, new RegExp(token));
  }
  assert.match(routeSource, /retrieval\.decision !== 'answer'/);
  assert.match(routeSource, /answerPassesGuardrails/);
});

test('CS-6 UI has role-specific shortcuts, citations, dates, and handoff', () => {
  assert.match(chatSource, /我是高校老师/);
  assert.match(chatSource, /我是学生 \/ 社团/);
  assert.match(chatSource, /QUICK_ACTIONS\[audience\]/);
  assert.match(chatSource, /信息日期/);
  assert.match(chatSource, /citation\.checkedAt/);
  assert.match(chatSource, /转人工合作咨询/);
  assert.doesNotMatch(chatSource, /Powered by DeepSeek/);
});

test('CS-5 handoff requires explicit purpose consent and has no side effect', () => {
  assert.match(cooperateSource, /checked=\{consented\}/);
  assert.match(cooperateSource, /disabled=\{!consented\}/);
  assert.match(cooperateSource, /仅用于人工跟进合作咨询/);
  assert.match(cooperateSource, /未发送、未公开、未上链/);
  assert.doesNotMatch(cooperateSource, /method=["']post["']|fetch\(|axios\./i);
});

test('CS-7 golden set has at least 30 grounded and adversarial cases', () => {
  assert.ok(evals.cases.length >= 30);
  const knowledgeIds = new Set(knowledge.entries.map((entry) => entry.id));
  const decisions = new Set(evals.cases.map((item) => item.expectedDecision));
  assert.deepEqual([...decisions].sort(), ['answer', 'handoff', 'refuse']);
  for (const item of evals.cases) {
    assert.ok(['teacher', 'student'].includes(item.audience), item.id);
    assert.ok(item.query, item.id);
    assert.ok(item.citationIds.length > 0, item.id);
    for (const citationId of item.citationIds) assert.ok(knowledgeIds.has(citationId), `${item.id}:${citationId}`);
  }
});

test('CS-8 no-key path returns reviewed FAQ instead of unavailable status', () => {
  assert.match(routeSource, /ASSISTANT_FORCE_FALLBACK/);
  assert.match(routeSource, /answerResponse\(retrieval, 'faq_fallback'\)/);
  assert.doesNotMatch(routeSource, /if \(!apiKey\) return errorResponse\('assistant_unavailable'/);
  assert.match(chatSource, /本地 FAQ 检索/);
  assert.match(chatSource, /等待首次检索/);
});
