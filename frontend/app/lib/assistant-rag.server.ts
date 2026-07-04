import 'server-only';

import knowledgeBundle from '../../data/assistant-knowledge.json';

export type AssistantAudience = 'teacher' | 'student';
export type AssistantDecision = 'answer' | 'refuse' | 'handoff';

type KnowledgeEntry = (typeof knowledgeBundle.entries)[number];

export type AssistantCitation = {
  id: string;
  title: string;
  label: string;
  url: string;
  checkedAt: string;
};

export type AssistantRetrieval = {
  decision: AssistantDecision;
  answer: string;
  citations: AssistantCitation[];
  knowledgeAsOf: string;
  handoffRequired: boolean;
  handoffReason: string | null;
  context: string;
};

const MAX_RESULTS = 3;
const HANDOFF_URL = '/user/cooperate';

const PROMPT_ATTACK = [
  '忽略之前', '忽略以上', '系统提示', 'system prompt', 'developer message', '泄露提示',
];
const SECRET_REQUEST = [
  'api 密钥', 'api key', '密码', '私钥', '助记词', '身份证号', '财务信息',
];
const FORBIDDEN_ACTION = [
  '替我签署', '帮我发布', '请自动发布', '替我发布', '帮我发邮件', '请自动发送邮件', '代替平台确认',
];
const GUARANTEE_WORDS = ['保证', '一定', '承诺', '稳赚', '保本'];
const GUARANTEE_TARGETS = [
  '奖金', '算力', '投资', '嘉宾', '曝光', '主办', '回复', '收益', '结果', '比分', '赛果',
];
const CURRENT_DETAIL_WORDS = [
  '怎么报名', '报名链接', '确切日期', '具体日期', '明年', '什么时候回复',
];

function normalize(value: string) {
  return value.toLowerCase().replace(/[\s，。！？、；：,.!?;:()（）/\\_-]+/g, '');
}

function includesAny(text: string, values: string[]) {
  const normalized = normalize(text);
  return values.some((value) => normalized.includes(normalize(value)));
}

function isCurrent(entry: KnowledgeEntry, today: string) {
  return entry.approved && entry.validFrom <= today && entry.validUntil >= today;
}

function scoreEntry(query: string, entry: KnowledgeEntry, audience: AssistantAudience) {
  const normalizedQuery = normalize(query);
  let score = entry.audiences.includes(audience) ? 1 : 0;
  for (const keyword of entry.keywords) {
    const normalizedKeyword = normalize(keyword);
    if (normalizedKeyword && normalizedQuery.includes(normalizedKeyword)) {
      score += Math.max(2, Math.min(7, normalizedKeyword.length));
    }
  }
  for (const token of normalize(entry.title).match(/.{2,4}/g) || []) {
    if (normalizedQuery.includes(token)) score += 1;
  }
  return score;
}

function toCitation(entry: KnowledgeEntry): AssistantCitation {
  return {
    id: entry.id,
    title: entry.title,
    label: entry.source.label,
    url: entry.source.url,
    checkedAt: entry.source.checkedAt,
  };
}

function uniqueEntries(entries: KnowledgeEntry[]) {
  return entries.filter((entry, index) => entries.findIndex((item) => item.id === entry.id) === index);
}

function findByIds(ids: string[], currentEntries: KnowledgeEntry[]) {
  return uniqueEntries(ids
    .map((id) => currentEntries.find((entry) => entry.id === id))
    .filter((entry): entry is KnowledgeEntry => Boolean(entry)));
}

function policyDecision(query: string) {
  if (includesAny(query, PROMPT_ATTACK) || includesAny(query, SECRET_REQUEST)) {
    return { decision: 'refuse' as const, ids: ['kb-privacy-boundary'], reason: 'security_boundary' };
  }
  if (includesAny(query, FORBIDDEN_ACTION)) {
    return { decision: 'refuse' as const, ids: ['kb-privacy-boundary'], reason: 'human_approval_required' };
  }
  if (includesAny(query, GUARANTEE_WORDS) && includesAny(query, GUARANTEE_TARGETS)) {
    const ids = includesAny(query, ['比分', '赛果', '收益', '稳赚'])
      ? ['kb-football-boundary']
      : includesAny(query, ['奖金', '算力', '投资'])
        ? ['kb-hackathon-support']
        : includesAny(query, ['嘉宾'])
          ? ['kb-space-support']
          : includesAny(query, ['曝光'])
            ? ['kb-media-support']
            : includesAny(query, ['回复'])
              ? ['kb-human-handoff']
              : ['kb-cooperation-models'];
    return { decision: 'refuse' as const, ids, reason: 'unapproved_guarantee' };
  }
  if (
    (includesAny(query, ['预测']) && includesAny(query, ['比分', '赛果']))
    || includesAny(query, ['预测比分', '押注', '下注', '博彩推荐', '博彩策略', '荐股'])
  ) {
    return { decision: 'refuse' as const, ids: ['kb-football-boundary'], reason: 'financial_or_betting_request' };
  }
  if (includesAny(query, CURRENT_DETAIL_WORDS)) {
    const ids = includesAny(query, ['报名'])
      ? ['kb-hackathon-support', 'kb-human-handoff']
      : ['kb-human-handoff'];
    return { decision: 'handoff' as const, ids, reason: 'current_detail_requires_confirmation' };
  }
  if (includesAny(query, ['转人工', '人工客服', '怎样联系', '如何联系', '确认合作日期'])) {
    return { decision: 'handoff' as const, ids: ['kb-human-handoff'], reason: 'user_requested_handoff' };
  }
  return null;
}

function refusalAnswer(entries: KnowledgeEntry[]) {
  const boundary = entries[0]?.answer || '这个请求超出 AI 客服可确认的范围。';
  return `抱歉，我不能按这个请求作出承诺或执行操作。${boundary}如需确认具体合作条件，请转人工处理。`;
}

function handoffAnswer(entries: KnowledgeEntry[], reason: string) {
  const known = entries.map((entry) => entry.answer).join('\n');
  const prefix = reason === 'user_requested_handoff'
    ? '可以，我为你提供人工合作咨询入口。'
    : '这项信息具有时效性或当前知识库证据不足，我不能替平台确认。';
  return `${prefix}${known ? `\n${known}` : ''}`;
}

function groundedAnswer(entries: KnowledgeEntry[]) {
  return entries.map((entry) => entry.answer).join('\n\n');
}

function buildContext(entries: KnowledgeEntry[]) {
  return entries.map((entry, index) => [
    `[S${index + 1}] ${entry.title}`,
    entry.answer,
    `来源：${entry.source.label}（核验于 ${entry.source.checkedAt}）`,
    `有效期：${entry.validFrom} 至 ${entry.validUntil}`,
  ].join('\n')).join('\n\n');
}

export function retrieveAssistantKnowledge(
  query: string,
  audience: AssistantAudience,
  now = new Date(),
): AssistantRetrieval {
  const today = now.toISOString().slice(0, 10);
  const approvedEntries = knowledgeBundle.entries.filter((entry) => entry.approved);
  const currentEntries = approvedEntries.filter((entry) => isCurrent(entry, today));
  const policy = policyDecision(query);

  if (policy) {
    const entries = findByIds(policy.ids, currentEntries);
    return {
      decision: policy.decision,
      answer: policy.decision === 'refuse'
        ? refusalAnswer(entries)
        : handoffAnswer(entries, policy.reason),
      citations: entries.map(toCitation),
      knowledgeAsOf: knowledgeBundle.reviewedAt,
      handoffRequired: true,
      handoffReason: policy.reason,
      context: buildContext(entries),
    };
  }

  const ranked = currentEntries
    .map((entry) => ({ entry, score: scoreEntry(query, entry, audience) }))
    .filter((item) => item.score >= 4)
    .sort((a, b) => b.score - a.score || a.entry.id.localeCompare(b.entry.id))
    .slice(0, MAX_RESULTS)
    .map((item) => item.entry);

  if (ranked.length === 0) {
    const staleMatch = approvedEntries.some((entry) => !isCurrent(entry, today) && scoreEntry(query, entry, audience) >= 4);
    const handoffEntries = findByIds(['kb-human-handoff'], currentEntries);
    return {
      decision: 'handoff',
      answer: staleMatch
        ? '相关知识条目已过期，我不能继续引用。请通过人工合作咨询确认最新信息。'
        : '当前审核知识库没有足够信息回答这个问题。为了避免猜测，请通过人工合作咨询确认。',
      citations: handoffEntries.map(toCitation),
      knowledgeAsOf: knowledgeBundle.reviewedAt,
      handoffRequired: true,
      handoffReason: staleMatch ? 'stale_knowledge' : 'unknown_question',
      context: buildContext(handoffEntries),
    };
  }

  const hasConflict = ranked.some((entry, index) => ranked
    .slice(index + 1)
    .some((candidate) => candidate.title === entry.title && candidate.answer !== entry.answer));
  if (hasConflict) {
    return {
      decision: 'handoff',
      answer: '审核知识库存在冲突信息，我不能选择其中一个版本。请转人工确认。',
      citations: ranked.map(toCitation),
      knowledgeAsOf: knowledgeBundle.reviewedAt,
      handoffRequired: true,
      handoffReason: 'conflicting_knowledge',
      context: buildContext(ranked),
    };
  }

  return {
    decision: 'answer',
    answer: groundedAnswer(ranked),
    citations: ranked.map(toCitation),
    knowledgeAsOf: knowledgeBundle.reviewedAt,
    handoffRequired: false,
    handoffReason: null,
    context: buildContext(ranked),
  };
}

export function answerPassesGuardrails(answer: string) {
  const normalized = normalize(answer);
  const forbiddenPatterns = [
    /保证.{0,10}(奖金|算力|投资|嘉宾|曝光|主办|回复|收益|结果)/,
    /(稳赚|保本|一定获奖|一定回复|一定出席)/,
  ];
  return !forbiddenPatterns.some((pattern) => pattern.test(normalized));
}

export const assistantHandoffUrl = HANDOFF_URL;
