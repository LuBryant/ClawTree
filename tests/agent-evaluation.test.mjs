import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { evaluateAgentGolden } from '../scripts/evaluate-agent-golden.mjs';

const fixture = JSON.parse(await readFile(
  new URL('../frontend/data/agent-golden-evals.json', import.meta.url),
  'utf8',
));
const schemas = JSON.parse(await readFile(
  new URL('../frontend/data/agent-schemas.json', import.meta.url),
  'utf8',
));
const frozenReport = JSON.parse(await readFile(
  new URL('../docs/agent-evaluation-report.json', import.meta.url),
  'utf8',
));
const packageJson = JSON.parse(await readFile(
  new URL('../package.json', import.meta.url),
  'utf8',
));

function clone(value) {
  return structuredClone(value);
}

test('AI-7 versioned golden set covers six tasks and low-confidence counterexamples', () => {
  assert.ok(fixture.cases.length >= 20);
  assert.match(fixture.meta.version, /^\d{4}-\d{2}-\d{2}\./);
  assert.equal(fixture.meta.schemaVersion, schemas.version);

  const expectedTasks = ['classify', 'compliance', 'dedup', 'match', 'proposal', 'reply'];
  assert.deepEqual([...new Set(fixture.cases.map((item) => item.task))].sort(), expectedTasks);
  assert.equal(new Set(fixture.cases.map((item) => item.id)).size, fixture.cases.length);
  assert.ok(fixture.cases.filter((item) => item.expectedLowConfidence).length >= 5);

  const allowedLabels = new Set(schemas.schemas.classify.properties.labels.items.enum);
  for (const item of fixture.cases.filter((candidate) => candidate.task === 'classify')) {
    assert.ok(item.expected.labels.every((label) => allowedLabels.has(label)), item.id);
  }
  for (const item of fixture.cases) {
    assert.ok(['known', 'unknown'].includes(item.prediction.decisionStatus), item.id);
    if (item.expectedLowConfidence) assert.equal(item.prediction.decisionStatus, 'unknown', item.id);
  }
  assert.deepEqual(
    [...new Set(fixture.cases.filter((item) => item.task === 'reply').map((item) => item.expected.intent))].sort(),
    ['decline', 'ooo', 'positive', 'question', 'unknown'],
  );
});

test('AI-8 evaluator reports required metrics and frozen report is reproducible', () => {
  const report = evaluateAgentGolden(fixture);
  assert.deepEqual(report, frozenReport);
  assert.equal(report.passed, true);
  assert.equal(report.metrics.classification.microF1, 1);
  assert.equal(report.metrics.dedup.precision, 1);
  assert.equal(report.metrics.dedup.recall, 1);
  assert.equal(report.metrics.citations.claimCoverage, 1);
  assert.equal(report.metrics.proposal.acceptanceAccuracy, 1);
  assert.equal(report.metrics.proposal.guardrailPassRate, 1);
  assert.equal(report.metrics.lowConfidence.reviewRecall, 1);
  assert.equal(report.metrics.lowConfidence.unknownDispositionRecall, 1);
  assert.match(packageJson.scripts['eval:agents'], /evaluate-agent-golden\.mjs/);
  assert.match(packageJson.scripts.check, /eval:agents/);
});

test('AI-8 evaluator fails closed on classification, citation, and proposal regressions', () => {
  const classificationRegression = clone(fixture);
  for (const item of classificationRegression.cases.filter((candidate) => candidate.task === 'classify')) {
    item.prediction.labels = ['irrelevant'];
  }
  assert.equal(evaluateAgentGolden(classificationRegression).checks.classificationMicroF1, false);

  const citationRegression = clone(fixture);
  citationRegression.cases[0].prediction.evidence[0].sourceIds = ['invented-source'];
  const citationReport = evaluateAgentGolden(citationRegression);
  assert.equal(citationReport.checks.citationCoverage, false);
  assert.ok(citationReport.metrics.citations.sourceValidity < 1);

  const proposalRegression = clone(fixture);
  const proposalCase = proposalRegression.cases.find((item) => item.task === 'proposal');
  proposalCase.prediction.guardrails.humanApprovalRequired = false;
  assert.equal(evaluateAgentGolden(proposalRegression).checks.proposalGuardrailPassRate, false);

  const forcedLowConfidenceAnswer = clone(fixture);
  const lowConfidenceClassify = forcedLowConfidenceAnswer.cases.find(
    (item) => item.id === 'classify-low-confidence-irrelevant',
  );
  lowConfidenceClassify.prediction.decisionStatus = 'known';
  lowConfidenceClassify.prediction.labels = ['irrelevant'];
  assert.equal(
    evaluateAgentGolden(forcedLowConfidenceAnswer).checks.lowConfidenceUnknownDispositionRecall,
    false,
  );
});

test('AI-8 evaluator rejects undersized or incomplete datasets', () => {
  assert.throws(
    () => evaluateAgentGolden({ ...fixture, cases: fixture.cases.slice(0, 19) }),
    /at least 20 cases/,
  );
  const withoutReply = clone(fixture);
  withoutReply.cases = withoutReply.cases.filter((item) => item.task !== 'reply');
  assert.throws(() => evaluateAgentGolden(withoutReply), /missing eval cases for task: reply/);
});
