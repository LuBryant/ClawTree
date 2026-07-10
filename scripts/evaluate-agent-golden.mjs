import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const DEFAULT_FIXTURE = path.join(root, 'frontend', 'data', 'agent-golden-evals.json');

const REQUIRED_CLAIMS = {
  classify: ['classification'],
  dedup: ['duplicate_decision'],
  compliance: ['risk_assessment', 'safe_summary'],
  match: ['match_score', 'fit_points'],
  proposal: ['proposal_basis', 'risks'],
  reply: ['intent', 'reply_summary'],
};

function ratio(numerator, denominator) {
  return denominator === 0 ? null : numerator / denominator;
}

function round(value) {
  return value === null ? null : Number(value.toFixed(4));
}

function binaryMetrics(expected, predicted) {
  let truePositive = 0;
  let falsePositive = 0;
  let falseNegative = 0;
  let trueNegative = 0;
  for (let index = 0; index < expected.length; index += 1) {
    if (expected[index] && predicted[index]) truePositive += 1;
    else if (!expected[index] && predicted[index]) falsePositive += 1;
    else if (expected[index] && !predicted[index]) falseNegative += 1;
    else trueNegative += 1;
  }
  const precision = ratio(truePositive, truePositive + falsePositive);
  const recall = ratio(truePositive, truePositive + falseNegative);
  const f1 = precision === null || recall === null || precision + recall === 0
    ? null
    : 2 * precision * recall / (precision + recall);
  return {
    truePositive,
    falsePositive,
    falseNegative,
    trueNegative,
    precision: round(precision),
    recall: round(recall),
    f1: round(f1),
    accuracy: round(ratio(truePositive + trueNegative, expected.length)),
  };
}

function multiclassMetrics(cases, field) {
  const labels = [...new Set(cases.flatMap((item) => [item.expected[field], item.prediction[field]]))].sort();
  const perLabel = {};
  for (const label of labels) {
    perLabel[label] = binaryMetrics(
      cases.map((item) => item.expected[field] === label),
      cases.map((item) => item.prediction[field] === label),
    );
  }
  const f1Values = Object.values(perLabel).map((item) => item.f1).filter((value) => value !== null);
  return {
    accuracy: round(ratio(
      cases.filter((item) => item.expected[field] === item.prediction[field]).length,
      cases.length,
    )),
    macroF1: round(ratio(f1Values.reduce((sum, value) => sum + value, 0), f1Values.length)),
    perLabel,
  };
}

function classificationMetrics(cases) {
  const universe = [...new Set(cases.flatMap((item) => [
    ...item.expected.labels,
    ...item.prediction.labels,
  ]))].sort();
  const expected = [];
  const predicted = [];
  const perLabel = {};
  for (const label of universe) {
    const labelExpected = cases.map((item) => item.expected.labels.includes(label));
    const labelPredicted = cases.map((item) => item.prediction.labels.includes(label));
    expected.push(...labelExpected);
    predicted.push(...labelPredicted);
    perLabel[label] = binaryMetrics(labelExpected, labelPredicted);
  }
  const micro = binaryMetrics(expected, predicted);
  const perLabelF1 = Object.values(perLabel).map((item) => item.f1).filter((value) => value !== null);
  return {
    caseCount: cases.length,
    microF1: micro.f1,
    macroF1: round(ratio(perLabelF1.reduce((sum, value) => sum + value, 0), perLabelF1.length)),
    exactMatchAccuracy: round(ratio(cases.filter((item) => {
      const expectedLabels = [...item.expected.labels].sort();
      const predictedLabels = [...item.prediction.labels].sort();
      return JSON.stringify(expectedLabels) === JSON.stringify(predictedLabels);
    }).length, cases.length)),
    perLabel,
  };
}

function citationMetrics(cases) {
  let requiredClaimCount = 0;
  let citedRequiredClaimCount = 0;
  let evidenceReferenceCount = 0;
  let validEvidenceReferenceCount = 0;
  let passingCases = 0;

  for (const item of cases) {
    const allowedSources = new Set(item.input.sourceIds || []);
    const evidence = Array.isArray(item.prediction.evidence) ? item.prediction.evidence : [];
    const requiredClaims = REQUIRED_CLAIMS[item.task] || [];
    let casePass = true;
    for (const claimId of requiredClaims) {
      requiredClaimCount += 1;
      const matching = evidence.filter((entry) => entry.claimId === claimId);
      const cited = matching.some((entry) =>
        Array.isArray(entry.sourceIds)
        && entry.sourceIds.length > 0
        && entry.sourceIds.every((sourceId) => allowedSources.has(sourceId))
      );
      if (cited) citedRequiredClaimCount += 1;
      else casePass = false;
    }
    for (const entry of evidence) {
      for (const sourceId of entry.sourceIds || []) {
        evidenceReferenceCount += 1;
        if (allowedSources.has(sourceId)) validEvidenceReferenceCount += 1;
        else casePass = false;
      }
    }
    if (casePass) passingCases += 1;
  }

  return {
    requiredClaimCount,
    citedRequiredClaimCount,
    claimCoverage: round(ratio(citedRequiredClaimCount, requiredClaimCount)),
    sourceValidity: round(ratio(validEvidenceReferenceCount, evidenceReferenceCount)),
    passingCaseRate: round(ratio(passingCases, cases.length)),
  };
}

function proposalGuardrailPass(item) {
  const guardrails = item.prediction.guardrails || {};
  return guardrails.noUnapprovedPrize === true
    && guardrails.noGuaranteedExposure === true
    && guardrails.humanApprovalRequired === true
    && item.prediction.containsForbiddenPromise === false
    && item.prediction.needsReview === true;
}

function hasUnknownDisposition(item) {
  if (item.prediction.decisionStatus !== 'unknown' || item.prediction.needsReview !== true) return false;
  if (item.task === 'classify') {
    return JSON.stringify(item.prediction.labels) === JSON.stringify(['unknown']);
  }
  if (item.task === 'dedup') return item.prediction.isDuplicate === null;
  if (item.task === 'compliance') return item.prediction.riskLevel === 'unknown';
  if (item.task === 'match') return item.prediction.score === null && item.prediction.accepted === false;
  if (item.task === 'proposal') return item.prediction.accepted === false;
  return item.prediction.intent === 'unknown';
}

export function evaluateAgentGolden(payload) {
  if (!payload?.meta?.version || !payload?.meta?.schemaVersion) {
    throw new Error('agent eval fixture must declare meta.version and meta.schemaVersion');
  }
  if (!Array.isArray(payload.cases) || payload.cases.length < 20) {
    throw new Error('agent eval fixture must contain at least 20 cases');
  }
  const duplicateIds = payload.cases.filter((item, index, all) =>
    all.findIndex((candidate) => candidate.id === item.id) !== index
  );
  if (duplicateIds.length > 0) throw new Error(`duplicate eval case id: ${duplicateIds[0].id}`);

  const byTask = Object.fromEntries(Object.keys(REQUIRED_CLAIMS).map((task) => [
    task,
    payload.cases.filter((item) => item.task === task),
  ]));
  for (const [task, cases] of Object.entries(byTask)) {
    if (cases.length === 0) throw new Error(`missing eval cases for task: ${task}`);
  }
  for (const item of payload.cases) {
    if (!['known', 'unknown'].includes(item.prediction?.decisionStatus)) {
      throw new Error(`missing decisionStatus for eval case: ${item.id}`);
    }
  }

  const classification = classificationMetrics(byTask.classify);
  const dedup = {
    caseCount: byTask.dedup.length,
    ...binaryMetrics(
      byTask.dedup.map((item) => item.expected.isDuplicate),
      byTask.dedup.map((item) => item.prediction.isDuplicate),
    ),
  };
  const compliance = {
    caseCount: byTask.compliance.length,
    ...multiclassMetrics(byTask.compliance, 'riskLevel'),
    highRiskRecall: binaryMetrics(
      byTask.compliance.map((item) => item.expected.riskLevel === 'high'),
      byTask.compliance.map((item) => item.prediction.riskLevel === 'high'),
    ).recall,
  };
  const match = {
    caseCount: byTask.match.length,
    acceptanceAccuracy: binaryMetrics(
      byTask.match.map((item) => item.expected.accepted),
      byTask.match.map((item) => item.prediction.accepted),
    ).accuracy,
    scoreMeanAbsoluteError: (() => {
      const scoredCases = byTask.match.filter((item) =>
        typeof item.expected.score === 'number' && typeof item.prediction.score === 'number'
      );
      return round(ratio(
        scoredCases.reduce((sum, item) => sum + Math.abs(item.expected.score - item.prediction.score), 0),
        scoredCases.length,
      ));
    })(),
  };
  const proposalAcceptance = binaryMetrics(
    byTask.proposal.map((item) => item.expected.accepted),
    byTask.proposal.map((item) => item.prediction.accepted),
  );
  const proposal = {
    caseCount: byTask.proposal.length,
    acceptanceAccuracy: proposalAcceptance.accuracy,
    acceptancePrecision: proposalAcceptance.precision,
    acceptanceRecall: proposalAcceptance.recall,
    acceptanceF1: proposalAcceptance.f1,
    acceptedRate: round(ratio(
      byTask.proposal.filter((item) => item.prediction.accepted).length,
      byTask.proposal.length,
    )),
    guardrailPassRate: round(ratio(
      byTask.proposal.filter(proposalGuardrailPass).length,
      byTask.proposal.length,
    )),
  };
  const reply = {
    caseCount: byTask.reply.length,
    ...multiclassMetrics(byTask.reply, 'intent'),
  };
  const citations = citationMetrics(payload.cases);
  const lowConfidenceCases = payload.cases.filter((item) => item.expectedLowConfidence === true);
  const lowConfidenceReviewRecall = round(ratio(
    lowConfidenceCases.filter((item) => item.prediction.needsReview === true).length,
    lowConfidenceCases.length,
  ));
  const lowConfidenceUnknownDispositionRecall = round(ratio(
    lowConfidenceCases.filter(hasUnknownDisposition).length,
    lowConfidenceCases.length,
  ));

  const metrics = {
    classification,
    dedup,
    compliance,
    match,
    proposal,
    reply,
    citations,
    lowConfidence: {
      caseCount: lowConfidenceCases.length,
      reviewRecall: lowConfidenceReviewRecall,
      unknownDispositionRecall: lowConfidenceUnknownDispositionRecall,
    },
  };
  const thresholds = payload.meta.thresholds;
  const checks = {
    classificationMicroF1: classification.microF1 >= thresholds.classificationMicroF1,
    dedupPrecision: dedup.precision >= thresholds.dedupPrecision,
    dedupRecall: dedup.recall >= thresholds.dedupRecall,
    citationCoverage: citations.claimCoverage >= thresholds.citationCoverage,
    proposalAcceptanceAccuracy: proposal.acceptanceAccuracy >= thresholds.proposalAcceptanceAccuracy,
    proposalGuardrailPassRate: proposal.guardrailPassRate >= thresholds.proposalGuardrailPassRate,
    lowConfidenceReviewRecall: lowConfidenceReviewRecall >= thresholds.lowConfidenceReviewRecall,
    lowConfidenceUnknownDispositionRecall: lowConfidenceUnknownDispositionRecall
      >= thresholds.lowConfidenceUnknownDispositionRecall,
  };

  return {
    datasetVersion: payload.meta.version,
    schemaVersion: payload.meta.schemaVersion,
    evaluatedAsOf: payload.meta.asOf,
    totalCases: payload.cases.length,
    taskCaseCounts: Object.fromEntries(Object.entries(byTask).map(([task, cases]) => [task, cases.length])),
    metrics,
    thresholds,
    checks,
    passed: Object.values(checks).every(Boolean),
  };
}

function parseOutputArgument(argv) {
  const index = argv.indexOf('--output');
  if (index === -1) return null;
  if (!argv[index + 1]) throw new Error('--output requires a path');
  return path.resolve(process.cwd(), argv[index + 1]);
}

function runCli() {
  const fixture = JSON.parse(readFileSync(DEFAULT_FIXTURE, 'utf8'));
  const report = evaluateAgentGolden(fixture);
  const serialized = `${JSON.stringify(report, null, 2)}\n`;
  const output = parseOutputArgument(process.argv.slice(2));
  if (output) writeFileSync(output, serialized);
  process.stdout.write(serialized);
  if (!report.passed) process.exitCode = 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  runCli();
}
