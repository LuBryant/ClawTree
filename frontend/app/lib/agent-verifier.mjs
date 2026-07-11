const PROMISE_PATTERNS = [
  /(?:保证|承诺|确保|必然|一定).{0,16}(?:奖金|收益|曝光|投资|录取|回报)/iu,
  /(?:guarantee|promise|ensure).{0,24}(?:prize|return|exposure|investment|admission)/iu,
];
const PRIVACY_PATTERNS = [
  /\b1[3-9]\d{9}\b/u,
  /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/iu,
  /\b(?:\d[ -]*?){16,19}\b/u,
  /(?:身份证|identity card|passport)\s*[:：]?\s*[A-Z0-9-]{6,}/iu,
];
const HIGH_RISK_RESOURCE_TERMS = [
  ['奖金', /奖金|prize/iu],
  ['算力', /算力|compute/iu],
  ['投资', /投资|investment/iu],
  ['嘉宾', /嘉宾|guest|speaker/iu],
  ['曝光', /曝光|exposure/iu],
];
const OPEN_REGISTRATION_PATTERN = /(?:仍可报名|报名(?:仍)?开放|立即报名|registration is (?:still )?open|apply now)/iu;

function flattenStrings(value, output = []) {
  if (typeof value === 'string') output.push(value);
  else if (Array.isArray(value)) value.forEach((item) => flattenStrings(item, output));
  else if (value && typeof value === 'object') Object.values(value).forEach((item) => flattenStrings(item, output));
  return output;
}

function parseDate(value) {
  if (typeof value !== 'string') return null;
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? timestamp : null;
}

/**
 * @param {{request: any, result: any, schemaErrors?: string[], now?: number}} options
 */
export function verifyHighRiskAgentResult({ request, result, schemaErrors = [], now = Date.now() }) {
  const reasonCodes = [];
  if (schemaErrors.length > 0) reasonCodes.push('INVALID_SCHEMA_OR_CITATION');
  const text = flattenStrings(result).join('\n');
  if (PROMISE_PATTERNS.some((pattern) => pattern.test(text))) reasonCodes.push('FORBIDDEN_COMMITMENT');
  if (PRIVACY_PATTERNS.some((pattern) => pattern.test(text))) reasonCodes.push('PRIVACY_DISCLOSURE');

  const event = request?.input?.event || {};
  const deadline = parseDate(event.registrationDeadline || event.deadline || event.endDate);
  if (deadline !== null && deadline < now && /(?:仍可报名|报名开放|立即报名|registration is open|apply now)/iu.test(text)) {
    reasonCodes.push('DATE_INCONSISTENCY');
  }

  const allowedSources = new Set(request?.input?.sourceIds || ['unverified-input']);
  const evidence = Array.isArray(result?.evidence) ? result.evidence : [];
  if (evidence.some((item) => !Array.isArray(item?.sourceIds)
    || item.sourceIds.some((sourceId) => !allowedSources.has(sourceId)))) {
    reasonCodes.push('UNSUPPORTED_CITATION');
  }

  return { safe: reasonCodes.length === 0, reasonCodes: [...new Set(reasonCodes)] };
}

export function buildTargetedRepairRequest(request, reasonCodes) {
  return {
    ...request,
    input: {
      ...request.input,
      verifierRepair: {
        attempt: 1,
        reasonCodes,
        instruction: '只修复列出的验证失败；删除无依据承诺和隐私数据，纠正日期，并仅引用允许的 sourceIds。',
      },
    },
  };
}

export function verifyHighRiskAssistantAnswer({
  answer,
  groundingContext = '',
  registrationState = 'unknown',
}) {
  const reasonCodes = [];
  if (typeof answer !== 'string' || !answer.trim()) reasonCodes.push('EMPTY_ANSWER');
  const text = typeof answer === 'string' ? answer : '';
  if (PROMISE_PATTERNS.some((pattern) => pattern.test(text))) reasonCodes.push('FORBIDDEN_COMMITMENT');
  if (PRIVACY_PATTERNS.some((pattern) => pattern.test(text))) reasonCodes.push('PRIVACY_DISCLOSURE');
  if (registrationState === 'closed' && OPEN_REGISTRATION_PATTERN.test(text)) reasonCodes.push('DATE_INCONSISTENCY');

  for (const [label, pattern] of HIGH_RISK_RESOURCE_TERMS) {
    if (pattern.test(text) && !pattern.test(groundingContext)) {
      reasonCodes.push(`UNSUPPORTED_HIGH_RISK_CLAIM:${label}`);
    }
  }
  return { safe: reasonCodes.length === 0, reasonCodes: [...new Set(reasonCodes)] };
}

export function assistantRepairInstruction(reasonCodes, language = 'zh') {
  const reasons = reasonCodes.join(', ');
  return language === 'en'
    ? `Rewrite the candidate answer once. Fix only these verifier failures: ${reasons}. Use only the supplied grounding context, remove personal data and unsupported commitments, and never claim registration is open after its verified deadline.`
    : `仅重写一次候选答案，并只修复这些验证失败：${reasons}。只能使用提供的证据上下文，删除个人信息和无依据承诺，已过核验截止时间时不得声称仍可报名。`;
}
