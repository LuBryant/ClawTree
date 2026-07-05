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
    if (item.answerMode === 'ai_general') {
      assert.equal(item.expectedDecision, 'answer', item.id);
      assert.equal(item.citationIds.length, 0, item.id);
    } else {
      assert.ok(item.citationIds.length > 0, item.id);
    }
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

test('CS-9 hybrid RAG + AI supports English intent and conversation context', () => {
  const overview = knowledge.entries.find((entry) => entry.id === 'kb-platform-overview');
  assert.ok(overview.keywords.includes("what's this"));
  assert.ok(overview.answerEn.startsWith('ClawTree'));
  assert.match(overview.answerEn, /TreeFinance is ClawTree's genesis customer/);
  assert.match(routeSource, /detectResponseLanguage\(latestUserMessage\.content, preferredLanguage\)/);
  assert.match(routeSource, /\\p\{Script=Han\}/);
  assert.match(routeSource, /messages\.slice\(0, -1\)\.slice\(-6\)/);
  assert.match(routeSource, /buildAssistantRagPrompt\(latestUserMessage\.content, retrieval\.context, language\)/);
  assert.match(chatSource, /streamChat\(chatHistory\.current, \{ audience, language, workspaceSlug: DEMO_WORKSPACE\.slug \}\)/);
});

test('CS-10 colloquial platform questions are pinned to reviewed overview knowledge', () => {
  assert.match(ragSource, /PLATFORM_OVERVIEW_INTENTS/);
  assert.match(ragSource, /findByIds\(\['kb-platform-overview'\], currentEntries\)/);
  for (const query of ['有啥用', '能干嘛', 'what does it do']) {
    assert.ok(knowledge.entries[0].keywords.includes(query), query);
  }
});

test('CS-11 standalone getting-started questions use the onboarding guide', () => {
  assert.match(ragSource, /GETTING_STARTED_INTENTS/);
  assert.match(ragSource, /matchesStandaloneIntent\(query, GETTING_STARTED_INTENTS\)/);
  assert.match(ragSource, /findByIds\(\['kb-getting-started'\], currentEntries\)/);
  const gettingStarted = knowledge.entries.find((entry) => entry.id === 'kb-getting-started');
  assert.ok(gettingStarted);
  assert.equal(gettingStarted.source.url, '/user');
  assert.match(gettingStarted.answer, /Signals/);
  assert.match(gettingStarted.answerEn, /Public Portal/);
});

test('CS-12 low-risk RAG misses use general AI while high-risk details stay gated', () => {
  assert.match(ragSource, /unknown_question is intentionally allowed through to the general AI path/);
  assert.match(ragSource, /citations: \[\]/);
  assert.match(routeSource, /retrieval\.citations\.length > 0 \? 'rag_model' : 'ai_model'/);
  assert.match(chatSource, /AI 通用回答/);
  assert.match(ragSource, /CONFIRMATION_SUBJECTS/);
  assert.match(ragSource, /CONFIRMATION_DETAILS/);
  assert.ok(evals.cases.some((item) => item.answerMode === 'ai_general' && item.citationIds.length === 0));
});
