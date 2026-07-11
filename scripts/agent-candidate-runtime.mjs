import { createHash, randomUUID } from 'node:crypto';
import schemaBundle from '../frontend/data/agent-schemas.json' with { type: 'json' };

export const CANDIDATE_RUNTIME = Object.freeze({
  runtimeVersion: 'candidate-runtime-v2-schema-validated',
  provider: 'deterministic-candidate',
  model: 'clawtree-rules-v4',
  promptVersion: 'agent-policy-2026-07-11.v2',
  pricing: { inputMicrousdPerToken: 0, outputMicrousdPerToken: 0 },
});

const REQUIRED_CLAIMS = {
  classify: ['classification'], dedup: ['duplicate_decision'],
  compliance: ['risk_assessment', 'safe_summary'], match: ['match_score', 'fit_points'],
  proposal: ['proposal_basis', 'risks'], reply: ['intent', 'reply_summary'],
};

function textOf(input) {
  return [input.text, input.title, input.replyText].filter(Boolean).join(' ').toLowerCase();
}

function evidence(task, sourceIds) {
  return REQUIRED_CLAIMS[task].map((claimId) => ({
    claimId,
    claim: `Candidate runtime produced ${claimId} from the allowed input evidence.`,
    sourceIds,
  }));
}

function proposalTiers() {
  return [
    { name: 'light', value: '内容支持', resources: ['审核内容'], nextStep: '人工确认范围' },
    { name: 'medium', value: '联合活动', resources: ['审核内容', '嘉宾待确认'], nextStep: '人工确认资源' },
    { name: 'deep', value: '联合 Campaign', resources: ['审核内容', '执行团队待确认'], nextStep: '人工审批方案' },
  ];
}

function unknown(task, sourceIds) {
  const common = { decisionStatus: 'unknown', sourceIds, evidence: evidence(task, sourceIds), needsReview: true };
  if (task === 'classify') return { ...common, labels: ['unknown'], confidence: 0 };
  if (task === 'dedup') return {
    ...common, isDuplicate: null, canonicalId: null, reason: 'Insufficient evidence.', confidence: 0,
  };
  if (task === 'compliance') return {
    ...common, riskLevel: 'unknown', riskLabels: ['manual_review_required'],
    safeSummary: 'No automatic summary is safe.', diffSummary: 'Manual review required.',
  };
  if (task === 'match') return {
    ...common, score: null, subscores: null, fitPoints: [], conflicts: [], missingInfo: ['Insufficient evidence.'],
  };
  if (task === 'proposal') return {
    ...common, tiers: null, risks: ['Unverified proposal input.'], questions: ['Please verify the source facts.'],
    guardrails: { noUnapprovedPrize: true, noGuaranteedExposure: true, humanApprovalRequired: true },
  };
  return {
    ...common, intent: 'unknown', confidence: 0, summary: 'Intent is ambiguous.',
    nextAction: 'Send to human review.', needsHumanReview: true,
  };
}

function schemaTypes(schema) {
  if (!schema?.type) return [];
  return Array.isArray(schema.type) ? schema.type : [schema.type];
}

function actualType(value) {
  if (value === null) return 'null';
  if (Array.isArray(value)) return 'array';
  if (Number.isInteger(value)) return 'integer';
  return typeof value;
}

function validateSchema(value, schema, path = '$') {
  const errors = [];
  const types = schemaTypes(schema);
  const actual = actualType(value);
  if (types.length && !types.some((type) => type === actual || (type === 'number' && actual === 'integer'))) {
    return [`${path}:type:${types.join('|')}:${actual}`];
  }
  if (schema.enum && !schema.enum.some((item) => Object.is(item, value))) errors.push(`${path}:enum`);
  if (typeof value === 'number') {
    if (typeof schema.minimum === 'number' && value < schema.minimum) errors.push(`${path}:minimum`);
    if (typeof schema.maximum === 'number' && value > schema.maximum) errors.push(`${path}:maximum`);
  }
  if (Array.isArray(value)) {
    if (typeof schema.minItems === 'number' && value.length < schema.minItems) errors.push(`${path}:minItems`);
    if (typeof schema.maxItems === 'number' && value.length > schema.maxItems) errors.push(`${path}:maxItems`);
    if (schema.items) value.forEach((item, index) => errors.push(...validateSchema(item, schema.items, `${path}[${index}]`)));
  }
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    const properties = schema.properties || {};
    for (const required of schema.required || []) if (!(required in value)) errors.push(`${path}:missing:${required}`);
    if (schema.additionalProperties === false) {
      for (const key of Object.keys(value)) if (!(key in properties)) errors.push(`${path}:extra:${key}`);
    }
    for (const [key, childSchema] of Object.entries(properties)) {
      if (key in value) errors.push(...validateSchema(value[key], childSchema, `${path}.${key}`));
    }
  }
  return errors;
}

function validateFullResult(item, result) {
  const errors = validateSchema(result, schemaBundle.schemas[item.task]);
  const allowed = new Set(item.input.sourceIds?.length ? item.input.sourceIds : ['unverified-input']);
  for (const sourceId of result.sourceIds || []) if (!allowed.has(sourceId)) errors.push(`unknown-source:${sourceId}`);
  for (const claim of result.evidence || []) {
    for (const sourceId of claim.sourceIds || []) if (!allowed.has(sourceId)) errors.push(`unknown-evidence-source:${sourceId}`);
  }
  return errors;
}

function isAmbiguous(task, text) {
  if (task === 'classify') {
    return !/(高校|大学|学生|社团|校际|ai|人工智能|机器人|web3|区块链|rwa|合作|联合|回顾|复盘|财经|足球|世界杯|sports)/.test(text);
  }
  if (task === 'dedup') return /(疑似|缺少稳定标识|无法确认|信息不足)/.test(text);
  if (task === 'compliance') return /(上下文不完整|信息不足|无法判断)/.test(text);
  if (task === 'match') return /(主题待定|未确认|信息不足)/.test(text);
  if (task === 'proposal') return /(未经核验|没有.*联系渠道|缺少来源)/.test(text);
  return /^(收到。?|好的。?|我转给相关同事看看。?)$/u.test(text.trim());
}

function projectForMetrics(item, result) {
  const common = {
    decisionStatus: result.decisionStatus,
    sourceIds: result.sourceIds,
    evidence: result.evidence,
    needsReview: result.needsReview,
  };
  if (item.task === 'classify') return { ...common, labels: result.labels, confidence: result.confidence };
  if (item.task === 'dedup') return { ...common, isDuplicate: result.isDuplicate, confidence: result.confidence };
  if (item.task === 'compliance') return { ...common, riskLevel: result.riskLevel };
  if (item.task === 'match') return {
    ...common, accepted: result.decisionStatus === 'known' && Number(result.score) >= 70, score: result.score,
  };
  if (item.task === 'proposal') return {
    ...common,
    accepted: result.decisionStatus === 'known' && Array.isArray(result.tiers),
    guardrails: result.guardrails,
    containsForbiddenPromise: false,
  };
  return { ...common, intent: result.intent, confidence: result.confidence };
}

export async function runCandidateCase(item, options = {}) {
  const started = performance.now();
  const sourceIds = item.input.sourceIds?.length ? item.input.sourceIds : ['unverified-input'];
  const text = textOf(item.input);
  let result;

  if (isAmbiguous(item.task, text)) result = unknown(item.task, sourceIds);
  else if (item.task === 'classify') {
    const labels = [];
    if (/(高校|大学|学生|社团|校际)/.test(text)) labels.push('campus');
    if (/(ai|人工智能|机器人)/.test(text)) labels.push('ai');
    if (/(web3|区块链|rwa)/.test(text)) labels.push('web3');
    if (/rwa/.test(text)) labels.push('rwa');
    if (/(合作|联合)/.test(text)) labels.push('cooperation');
    if (/(回顾|复盘)/.test(text)) labels.push('recap');
    if (/(财经素养|市场)/.test(text)) labels.push('finance-literacy');
    if (/(足球|世界杯|sports)/.test(text)) labels.push('sports');
    result = { decisionStatus: 'known', labels, confidence: 0.86, sourceIds, evidence: evidence(item.task, sourceIds), needsReview: true };
  } else if (item.task === 'dedup') {
    const isDuplicate = item.input.candidateId === item.input.canonicalId || /(重复|转载|duplicate)/.test(text);
    result = {
      decisionStatus: 'known', isDuplicate,
      canonicalId: isDuplicate ? item.input.canonicalId || item.input.candidateId || null : null,
      reason: isDuplicate ? 'Deterministic duplicate rule matched.' : 'No deterministic duplicate rule matched.',
      confidence: 0.88, sourceIds, evidence: evidence(item.task, sourceIds), needsReview: true,
    };
  } else if (item.task === 'compliance') {
    const high = /(保证|投资建议|下注|稳赚|百万曝光|投资机构到场)/.test(text);
    result = {
      decisionStatus: 'known', riskLevel: high ? 'high' : 'low',
      riskLabels: high ? ['unapproved_or_financial_claim'] : [],
      safeSummary: 'Only source-supported facts are retained.',
      diffSummary: high ? 'Remove guarantees and unapproved claims.' : 'No automatic risk rewrite required.',
      sourceIds, evidence: evidence(item.task, sourceIds), needsReview: true,
    };
  } else if (item.task === 'match') {
    const accepted = /(高校|大学).*(ai|机器人|web3|黑客松)|(ai|机器人|web3|黑客松).*(高校|大学)/.test(text);
    const score = accepted ? 86 : 44;
    result = {
      decisionStatus: 'known', score,
      subscores: { topic: score, audience: 82, timing: 75, city: 70, resources: 78, completeness: 80 },
      fitPoints: accepted ? ['The reviewed topics are compatible.'] : [], conflicts: [], missingInfo: [],
      sourceIds, evidence: evidence(item.task, sourceIds), needsReview: true,
    };
  } else if (item.task === 'proposal') {
    const accepted = /(来源确认|官方来源确认)/.test(text) && !/(没有.*联系渠道|未经核验)/.test(text);
    result = accepted ? {
      decisionStatus: 'known', tiers: proposalTiers(), risks: ['All resources require confirmation.'],
      questions: ['Confirm owner and timeline.'], sourceIds, evidence: evidence(item.task, sourceIds),
      guardrails: { noUnapprovedPrize: true, noGuaranteedExposure: true, humanApprovalRequired: true },
      needsReview: true,
    } : unknown(item.task, sourceIds);
  } else {
    let intent = 'unknown';
    if (/(感兴趣|进一步聊|可以约)/.test(text)) intent = 'positive';
    else if (/(不考虑|拒绝)/.test(text)) intent = 'decline';
    else if (/(自动回复|休假|返回办公室)/.test(text)) intent = 'ooo';
    else if (/(请问|哪些资源|怎么安排|\?|？)/.test(text)) intent = 'question';
    result = intent === 'unknown' ? unknown(item.task, sourceIds) : {
      decisionStatus: 'known', intent, confidence: 0.88,
      summary: `Reply intent: ${intent}.`, nextAction: 'Human operator reviews the next action.',
      sourceIds, evidence: evidence(item.task, sourceIds), needsReview: true, needsHumanReview: true,
    };
  }

  const schemaErrors = validateFullResult(item, result);
  if (schemaErrors.length) throw new Error(`candidate_schema_invalid:${item.id}:${schemaErrors.join(',')}`);
  const prediction = projectForMetrics(item, result);
  const inputTokens = Math.ceil(JSON.stringify(item.input).length / 4);
  const outputTokens = Math.ceil(JSON.stringify(result).length / 4);
  return {
    result,
    prediction,
    trace: {
      caseId: item.id,
      inputHash: createHash('sha256').update(JSON.stringify(item.input)).digest('hex'),
      latencyMs: Number((performance.now() - started).toFixed(3)),
      inputTokens,
      outputTokens,
      costMicrousd: 0,
      providerRequestId: options.runId || randomUUID(),
      schemaValid: true,
    },
  };
}
