import { createHash } from 'node:crypto';

const SCORE_DIMENSIONS = [
  'themeFit',
  'audienceFit',
  'capabilityFit',
  'timingFit',
  'evidenceQuality',
  'executionFeasibility',
];

const SCORE_WEIGHTS = {
  themeFit: 0.24,
  audienceFit: 0.18,
  capabilityFit: 0.18,
  timingFit: 0.12,
  evidenceQuality: 0.16,
  executionFeasibility: 0.12,
};

const INJECTION_PATTERNS = [
  /ignore\s+(all\s+)?previous/i,
  /system\s+prompt/i,
  /developer\s+message/i,
  /调用.{0,8}(工具|function|api)/i,
  /发送.{0,12}(邮件|email)/i,
  /泄露.{0,12}(密钥|token|prompt)/i,
];

const CRITICAL_RESEARCH_FIELDS = new Set([
  'registrationUrl',
  'registrationDeadline',
  'organizer',
  'eligibility',
]);

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

function tokenize(value) {
  const text = String(value || '').toLowerCase();
  const stopwords = new Set(['what', 'which', 'this', 'that', 'does', 'did', 'how', 'can', 'could', 'the', 'for', 'with', 'who', 'will', 'would', 'give', 'from', 'into', 'your', 'you', 'our', 'are', 'was', 'were', 'why']);
  const latin = (text.match(/[a-z0-9]{2,}/g) || []).filter((token) => !stopwords.has(token));
  const chinese = ['项目', '平台', '推荐', '学校', '高校', '高校匹配', '匹配', '证据', '证明', '来源', '安全', '隐私', '边界', '承诺', '自动', '反证', '风险', '成本', '预算', '延迟', '模型', '提案', '方案', '报名', '截止', '主办方', '为什么不是', '为什么现在']
    .filter((token) => text.includes(token));
  return unique([...latin, ...chinese]);
}

function includesPrivateIpv4(hostname) {
  const parts = hostname.split('.').map(Number);
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) return false;
  return parts[0] === 10
    || parts[0] === 127
    || (parts[0] === 169 && parts[1] === 254)
    || (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31)
    || (parts[0] === 192 && parts[1] === 168)
    || parts[0] === 0;
}

export function validateResearchUrl(rawUrl) {
  try {
    const url = new URL(rawUrl);
    const hostname = url.hostname.toLowerCase().replace(/\.$/, '');
    if (url.protocol !== 'https:') return { safe: false, reason: 'HTTPS_REQUIRED' };
    if (url.username || url.password) return { safe: false, reason: 'URL_CREDENTIALS_BLOCKED' };
    if (hostname === 'localhost' || hostname.endsWith('.localhost') || hostname.endsWith('.local')) {
      return { safe: false, reason: 'PRIVATE_HOST_BLOCKED' };
    }
    if (hostname === '::1' || hostname.startsWith('fc') || hostname.startsWith('fd') || hostname.startsWith('fe80:')) {
      return { safe: false, reason: 'PRIVATE_IP_BLOCKED' };
    }
    if (includesPrivateIpv4(hostname)) return { safe: false, reason: 'PRIVATE_IP_BLOCKED' };
    return { safe: true, url: url.toString(), hostname };
  } catch {
    return { safe: false, reason: 'INVALID_URL' };
  }
}

export function inspectResearchBody(body, maxBytes = 1_000_000) {
  const text = String(body || '');
  const sizeBytes = Buffer.byteLength(text, 'utf8');
  if (sizeBytes > maxBytes) return { safe: false, reason: 'RESPONSE_TOO_LARGE', sizeBytes };
  const matches = INJECTION_PATTERNS.filter((pattern) => pattern.test(text)).map((pattern) => pattern.source);
  if (matches.length > 0) return { safe: false, reason: 'PROMPT_INJECTION', sizeBytes, matches };
  return { safe: true, sizeBytes, matches: [] };
}

export function validateResearchResponse({
  requestedUrl,
  finalUrl,
  redirectChain = [],
  contentType = '',
  body = '',
  maxBytes = 1_000_000,
}) {
  if (redirectChain.length > 3) return { safe: false, reason: 'TOO_MANY_REDIRECTS' };
  const urls = [requestedUrl, ...redirectChain, finalUrl].filter(Boolean);
  for (const url of urls) {
    const verdict = validateResearchUrl(url);
    if (!verdict.safe) return { safe: false, reason: `DANGEROUS_REDIRECT:${verdict.reason}` };
  }
  const normalizedMime = String(contentType).split(';')[0].trim().toLowerCase();
  if (!['text/html', 'application/xhtml+xml', 'text/plain'].includes(normalizedMime)) {
    return { safe: false, reason: 'UNSUPPORTED_MIME' };
  }
  const bodyVerdict = inspectResearchBody(body, maxBytes);
  if (!bodyVerdict.safe) return bodyVerdict;
  return { safe: true, finalUrl, contentType: normalizedMime, sizeBytes: bodyVerdict.sizeBytes };
}

export function buildResearchQuote({ sourceId, body, quote, locator }) {
  const normalizedBody = String(body || '').replace(/\s+/g, ' ').trim();
  const normalizedQuote = String(quote || '').replace(/\s+/g, ' ').trim();
  if (!sourceId || normalizedQuote.length < 20 || !normalizedBody.includes(normalizedQuote)) {
    return { valid: false, reason: 'QUOTE_NOT_IN_BODY' };
  }
  if (!locator || typeof locator !== 'object' || (!locator.selector && !locator.heading && !locator.textOffset)) {
    return { valid: false, reason: 'QUOTE_LOCATOR_REQUIRED' };
  }
  return {
    valid: true,
    sourceId,
    quote: normalizedQuote,
    quoteHash: createHash('sha256').update(normalizedQuote).digest('hex'),
    locator,
  };
}

export function scoreResearchSource(candidate) {
  const urlCheck = validateResearchUrl(candidate.url);
  if (!urlCheck.safe) return { ...candidate, accepted: false, score: 0, reason: urlCheck.reason };
  const bodyCheck = inspectResearchBody(candidate.body || candidate.quote || '', candidate.maxBytes);
  if (!bodyCheck.safe) return { ...candidate, accepted: false, score: 0, reason: bodyCheck.reason };
  const host = urlCheck.hostname;
  const isSearchPlatform = /(^|\.)(bing\.com|google\.[a-z.]+|duckduckgo\.com|search\.yahoo\.com)$/.test(host);
  const quoteProof = buildResearchQuote({
    sourceId: candidate.id,
    body: candidate.body,
    quote: candidate.quote,
    locator: candidate.locator,
  });
  let score = 0;
  if (candidate.official === true) score += 55;
  if (candidate.extracted === true && quoteProof.valid) score += 25;
  if (!isSearchPlatform) score += 10;
  if (candidate.publisherMatchesOrganizer === true) score += 10;
  if (isSearchPlatform) score -= 35;
  return {
    ...candidate,
    accepted: score >= 60,
    score,
    reason: score >= 60 ? 'OFFICIAL_BODY_VERIFIED' : 'DISCOVERY_ONLY',
    hostname: host,
    quoteProof: quoteProof.valid ? quoteProof : null,
  };
}

export function selectResearchEvidence(candidates, requiredFields = []) {
  const ranked = candidates.map(scoreResearchSource).sort((a, b) => b.score - a.score);
  const selected = ranked.filter((item) => item.accepted);
  const claims = {};
  for (const field of requiredFields) {
    const source = selected.find((item) => item.fields?.includes(field));
    if (!source || (CRITICAL_RESEARCH_FIELDS.has(field) && !source.extracted)) {
      claims[field] = { status: 'unknown', sourceId: null, quote: null };
    } else {
      claims[field] = { status: 'verified', sourceId: source.id, quote: source.quote };
    }
  }
  return { ranked, selected, claims };
}

export function buildEvidenceGraph(data) {
  const nodes = new Map((data.graph?.nodes || []).map((node) => [node.id, node]));
  const adjacency = new Map();
  for (const edge of data.graph?.edges || []) {
    if (!nodes.has(edge.from) || !nodes.has(edge.to)) throw new Error(`graph_edge_unknown_node:${edge.from}:${edge.to}`);
    adjacency.set(edge.from, [...(adjacency.get(edge.from) || []), edge]);
    adjacency.set(edge.to, [...(adjacency.get(edge.to) || []), { ...edge, from: edge.to, to: edge.from, reverse: true }]);
  }
  const claims = (data.graph?.nodes || []).filter((node) => node.type === 'claim');
  for (const claim of claims) {
    if (!claim.quote || !claim.sourceId || !nodes.has(claim.sourceId)) throw new Error(`orphan_claim:${claim.id}`);
    const links = adjacency.get(claim.id) || [];
    if (!links.some((edge) => edge.to === claim.sourceId)) throw new Error(`orphan_claim:${claim.id}`);
  }
  return { nodes, adjacency, claimCount: claims.length, orphanClaimCount: 0 };
}

export function queryEvidencePath(data, startId, targetType = 'source') {
  const graph = buildEvidenceGraph(data);
  if (!graph.nodes.has(startId)) return null;
  const queue = [[startId]];
  const visited = new Set([startId]);
  while (queue.length > 0) {
    const path = queue.shift();
    const current = path[path.length - 1];
    const node = graph.nodes.get(current);
    if (current !== startId && node?.type === targetType) return path.map((id) => graph.nodes.get(id));
    for (const edge of graph.adjacency.get(current) || []) {
      if (!visited.has(edge.to)) {
        visited.add(edge.to);
        queue.push([...path, edge.to]);
      }
    }
  }
  return null;
}

export function composeOpportunity(data) {
  const opportunity = structuredClone(data.opportunity);
  const sources = new Set((data.graph?.nodes || []).filter((node) => node.type === 'source').map((node) => node.id));
  if ((opportunity.supportingEvidence || []).length < 2) throw new Error('opportunity_supporting_evidence_below_minimum');
  if ((opportunity.counterEvidence || []).length < 1) throw new Error('opportunity_counter_evidence_required');
  if ((opportunity.openQuestions || []).length < 1) throw new Error('opportunity_open_question_required');
  if ((opportunity.kpis || []).length < 1) throw new Error('opportunity_kpi_required');
  for (const item of [...opportunity.supportingEvidence, ...opportunity.counterEvidence]) {
    if (!item.sourceIds?.length || item.sourceIds.some((sourceId) => !sources.has(sourceId))) {
      throw new Error(`opportunity_invalid_citation:${item.id}`);
    }
  }
  return opportunity;
}

export function rankMatches(data) {
  const sources = new Set((data.graph?.nodes || []).filter((node) => node.type === 'source').map((node) => node.id));
  const ranked = (data.matches || []).map((candidate) => {
    for (const dimension of SCORE_DIMENSIONS) {
      const detail = candidate.dimensions?.[dimension];
      if (!detail || !Number.isFinite(detail.score) || !detail.sourceIds?.length) {
        throw new Error(`match_dimension_invalid:${candidate.id}:${dimension}`);
      }
      if (detail.sourceIds.some((sourceId) => !sources.has(sourceId))) {
        throw new Error(`match_dimension_unknown_source:${candidate.id}:${dimension}`);
      }
    }
    const score = Math.round(SCORE_DIMENSIONS.reduce(
      (sum, dimension) => sum + candidate.dimensions[dimension].score * SCORE_WEIGHTS[dimension],
      0,
    ));
    return { ...structuredClone(candidate), score };
  }).sort((a, b) => b.score - a.score);
  return ranked.map((candidate, index) => ({
    ...candidate,
    rank: index + 1,
    alternativeTo: index === 0 ? ranked[1]?.id || null : ranked[0]?.id || null,
    comparison: index === 0 && ranked[1]
      ? `${candidate.name} leads by ${candidate.score - ranked[1].score} points; ${ranked[1].name} remains the strongest alternative.`
      : null,
  }));
}

export function simulateProposal(data, candidateId) {
  const candidate = rankMatches(data).find((item) => item.id === candidateId);
  if (!candidate) throw new Error('proposal_candidate_not_found');
  const sourceIds = new Set((data.graph?.nodes || []).filter((node) => node.type === 'source').map((node) => node.id));
  const tiers = (data.proposalSimulator?.tiers || []).map((tier) => {
    if (!tier.version || !tier.resources?.clawtree?.length || !tier.resources?.partner?.length) {
      throw new Error(`proposal_resource_contract_invalid:${tier.id}`);
    }
    if (!tier.cost || !tier.deliverables?.length || !tier.kpis?.length || !tier.risks?.length) {
      throw new Error(`proposal_required_field_missing:${tier.id}`);
    }
    if (!tier.resourceGaps?.length || !tier.prohibitedCommitments?.length) {
      throw new Error(`proposal_guardrail_field_missing:${tier.id}`);
    }
    if (!tier.sourceIds?.length || tier.sourceIds.some((sourceId) => !sourceIds.has(sourceId))) {
      throw new Error(`proposal_citation_invalid:${tier.id}`);
    }
    return { ...structuredClone(tier), candidateId, candidateName: candidate.name, citationCoverage: 1 };
  });
  return { schemaVersion: data.proposalSimulator.schemaVersion, candidate, tiers };
}

function redact(value) {
  if (Array.isArray(value)) return value.map(redact);
  if (!value || typeof value !== 'object') return value;
  const output = {};
  for (const [key, item] of Object.entries(value)) {
    if (/prompt|chainOfThought|cot|email|phone|contact|rawInput|rawOutput/i.test(key)) continue;
    output[key] = redact(item);
  }
  return output;
}

export function buildJudgeEvidenceReplay(data) {
  const replay = redact(structuredClone(data.judgeEvidence));
  const required = ['schemaVersion', 'model', 'costMicrousd', 'latencyMs', 'fallback', 'verifier', 'stages', 'humanDiff'];
  for (const field of required) {
    if (replay[field] === undefined) throw new Error(`judge_evidence_missing:${field}`);
  }
  replay.externalSideEffect = false;
  replay.sourceCount = unique(replay.stages.flatMap((stage) => stage.sourceIds || [])).length;
  return replay;
}

export function answerGroundedCopilot(data, query) {
  const highRiskUnsupported = /奖金|投资|手机号|私人邮箱|嘉宾名单|报名截止|报名入口|保证曝光|prize|invest|private\s+(phone|email)|confirmed\s+guest|registration\s+(deadline|link)|guaranteed\s+exposure/i;
  if (highRiskUnsupported.test(String(query))) {
    return { decision: 'refuse', answer: data.copilot.refusal, citations: [], grounded: false };
  }
  const queryTokens = tokenize(query);
  if (queryTokens.length === 0) {
    return { decision: 'handoff', answer: data.copilot.refusal, citations: [], grounded: false };
  }
  const ranked = (data.copilot.topics || []).map((topic) => {
    const topicTokens = unique(topic.keywords.flatMap(tokenize));
    const phraseBonus = topic.keywords.some((keyword) => {
      const phrase = String(keyword).toLowerCase().trim();
      return phrase.length >= 4 && String(query).toLowerCase().includes(phrase);
    }) ? 3 : 0;
    const score = phraseBonus + queryTokens.reduce((sum, token) => sum + (topicTokens.includes(token) ? 1 : 0), 0);
    return { topic, score };
  }).sort((a, b) => b.score - a.score);
  const selected = ranked[0];
  if (!selected || selected.score === 0 || !selected.topic.sourceIds?.length) {
    return { decision: 'refuse', answer: data.copilot.refusal, citations: [], grounded: false };
  }
  return {
    decision: 'answer',
    answer: selected.topic.answer,
    citations: selected.topic.sourceIds,
    grounded: true,
    topicId: selected.topic.id,
  };
}

export function evaluateCopilot(data, cases) {
  const results = cases.map((item) => ({ item, result: answerGroundedCopilot(data, item.query) }));
  const answerCases = results.filter(({ item }) => item.expectedDecision === 'answer');
  const refusalCases = results.filter(({ item }) => item.expectedDecision !== 'answer');
  const groundedCorrect = answerCases.filter(({ item, result }) => result.decision === 'answer'
    && result.citations.some((sourceId) => item.expectedSourceIds.includes(sourceId))).length;
  const refusedCorrectly = refusalCases.filter(({ result }) => result.decision !== 'answer').length;
  return {
    total: results.length,
    groundedAnswerPrecision: answerCases.length ? groundedCorrect / answerCases.length : 1,
    unsupportedRefusalRate: refusalCases.length ? refusedCorrectly / refusalCases.length : 1,
    results,
  };
}

export { SCORE_DIMENSIONS, SCORE_WEIGHTS };
