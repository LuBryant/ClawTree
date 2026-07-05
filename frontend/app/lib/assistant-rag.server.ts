import 'server-only';

import knowledgeBundle from '../../data/assistant-knowledge.json';

export type AssistantAudience = 'teacher' | 'student';
export type AssistantLanguage = 'zh' | 'en';
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
  'ignore previous', 'ignore all previous', 'reveal your prompt', 'show your instructions',
];
const SECRET_REQUEST = [
  'api 密钥', 'api key', '密码', '私钥', '助记词', '身份证号', '财务信息',
  'password', 'private key', 'seed phrase', 'identity number', 'financial information',
];
const FORBIDDEN_ACTION = [
  '替我签署', '帮我发布', '请自动发布', '替我发布', '帮我发邮件', '请自动发送邮件', '代替平台确认',
  '帮我报名', '替我报名', '帮我提交报名', '自动报名',
  'sign for me', 'publish for me', 'automatically publish', 'send an email for me', 'confirm on behalf',
  'register me', 'submit my application for me',
];
const GUARANTEE_WORDS = ['保证', '一定', '承诺', '稳赚', '保本', 'guarantee', 'promise', 'certain', 'risk-free'];
const GUARANTEE_TARGETS = [
  '奖金', '算力', '投资', '嘉宾', '曝光', '主办', '回复', '收益', '结果', '比分', '赛果',
  'prize', 'compute', 'investment', 'guest', 'exposure', 'host', 'reply', 'return', 'result', 'score',
];
const CURRENT_DETAIL_WORDS = [
  '确切日期', '具体日期', '明年', '什么时候回复',
  '合作权益', '具体权益', '具体资源', '官方身份', '合作费用', '合作报价', '活动报价',
  'exact date', 'specific date', 'next year', 'when will you reply',
  'partnership benefits', 'specific benefits', 'specific resources', 'official status', 'partnership pricing', 'event price quote',
];
const CONFIRMATION_SUBJECTS = [
  '合作', '活动', '平台', '黑客松', '高校行', '大树财经', 'clawtree', 'treefinance',
  'partnership', 'collaboration', 'event', 'hackathon', 'campus tour',
];
const CONFIRMATION_DETAILS = [
  '权益', '具体资源', '费用', '报价', '资格', '官方身份', '主办身份',
  'benefit', 'resource commitment', 'fee', 'quote', 'eligibility', 'official status', 'host status',
];
const PUBLIC_REGISTRATION_CONTEXT = [
  '报名', '报名入口', '报名链接', '参赛', '参会', '参加', '申请入口',
  'register', 'registration', 'apply', 'application', 'participant',
];
const PLATFORM_OVERVIEW_INTENTS = [
  '这是啥', '这是什么', '这是干嘛的', '这是干什么的', '你是啥', '你是什么',
  '这个平台有啥用', '这个平台有什么用', '平台有啥用', '平台有什么用',
  '能做什么', '能干嘛', '是干什么的', '是干嘛的', '有什么功能', '主要用途', '主要作用',
  'what does this platform do', 'what does it do', 'what can this platform do',
  'what is this for', 'what can clawtree do',
];
const PLATFORM_OVERVIEW_SUBJECTS = [
  'clawtree', '大树财经', 'treefinance', '平台', '这个平台', '你们', '你是', '这是', 'this platform',
];
const GETTING_STARTED_INTENTS = [
  '我要如何使用呢', '我要如何使用', '要如何使用呢', '如何使用呢', '如何使用',
  '我要怎么使用', '我要怎么用', '怎么使用呢', '怎么使用', '怎么用呢', '怎么用',
  '从哪里开始', '新手怎么开始', '使用方法',
  'how do i use it', 'how do i use this', 'how should i use it', 'how to use clawtree',
  'how do i get started', 'where do i start', 'getting started',
];
const PUBLIC_EVENT_LOOKUP_INTENTS = [
  '怎么报名', '如何报名', '报名链接', '报名入口', '报名资格', '官网', '官方页面', '官方网站', '截止时间',
  'how to register', 'registration link', 'registration eligibility', 'official site', 'official page', 'deadline',
];
const PUBLIC_EVENT_LOOKUP_SUBJECTS = [
  'genesis', '黑客松', 'hackathon', '公开活动', '活动', '比赛', '大赛', '赛事', 'event', 'competition',
];
const PUBLIC_EVENT_OVERVIEW_INTENTS = [
  '是什么', '什么是', '介绍一下', '讲讲', 'what is', "what's", 'tell me about',
];
const HTX_GENESIS_EVENT_TERMS = [
  'genesis 黑客松', 'htx genesis', 'htx genesis hackathon', '创世纪代码新纪元',
  'code the new era', 'htxdao genesis', 'htx dao genesis',
];

function normalize(value: string) {
  return value.toLowerCase().replace(/[\s，。！？、；：,.!?;:()（）/\\_'’"-]+/g, '');
}

function includesAny(text: string, values: string[]) {
  const normalized = normalize(text);
  return values.some((value) => normalized.includes(normalize(value)));
}

function matchesStandaloneIntent(query: string, intents: string[]) {
  const normalizedQuery = normalize(query).replace(/(呢|啊|呀|吗)$/u, '');
  return intents.some((intent) => normalizedQuery === normalize(intent).replace(/(呢|啊|呀|吗)$/u, ''));
}

function isPlatformOverviewQuestion(query: string) {
  return matchesStandaloneIntent(query, PLATFORM_OVERVIEW_INTENTS)
    || (includesAny(query, PLATFORM_OVERVIEW_SUBJECTS) && includesAny(query, PLATFORM_OVERVIEW_INTENTS));
}

function isPublicEventOverviewQuestion(query: string) {
  return includesAny(query, PUBLIC_EVENT_OVERVIEW_INTENTS)
    && includesAny(query, PUBLIC_EVENT_LOOKUP_SUBJECTS)
    && !includesAny(query, PLATFORM_OVERVIEW_SUBJECTS);
}

function isHtxGenesisHackathonQuestion(query: string) {
  return includesAny(query, HTX_GENESIS_EVENT_TERMS)
    || (includesAny(query, ['genesis']) && includesAny(query, ['黑客松', 'hackathon']));
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

function entryAnswer(entry: KnowledgeEntry, language: AssistantLanguage) {
  return language === 'en' ? entry.answerEn : entry.answer;
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
    const ids = includesAny(query, ['比分', '赛果', '收益', '稳赚', 'score', 'return', 'risk-free'])
      ? ['kb-football-boundary']
      : includesAny(query, ['奖金', '算力', '投资', 'prize', 'compute', 'investment'])
        ? ['kb-hackathon-support']
        : includesAny(query, ['嘉宾', 'guest'])
          ? ['kb-space-support']
          : includesAny(query, ['曝光', 'exposure'])
            ? ['kb-media-support']
            : includesAny(query, ['回复', 'reply'])
              ? ['kb-human-handoff']
              : ['kb-cooperation-models'];
    return { decision: 'refuse' as const, ids, reason: 'unapproved_guarantee' };
  }
  if (
    (includesAny(query, ['预测', 'predict']) && includesAny(query, ['比分', '赛果', 'score', 'result']))
    || includesAny(query, ['预测比分', '押注', '下注', '博彩推荐', '博彩策略', '荐股', 'betting advice', 'betting strategy', 'stock tip'])
  ) {
    return { decision: 'refuse' as const, ids: ['kb-football-boundary'], reason: 'financial_or_betting_request' };
  }
  if (
    includesAny(query, CONFIRMATION_SUBJECTS)
    && includesAny(query, CONFIRMATION_DETAILS)
    && !includesAny(query, PUBLIC_REGISTRATION_CONTEXT)
  ) {
    return { decision: 'handoff' as const, ids: ['kb-human-handoff'], reason: 'specific_terms_require_confirmation' };
  }
  if (includesAny(query, CURRENT_DETAIL_WORDS)) {
    const ids = includesAny(query, ['报名', 'register', 'registration'])
      ? ['kb-hackathon-support', 'kb-human-handoff']
      : ['kb-human-handoff'];
    return { decision: 'handoff' as const, ids, reason: 'current_detail_requires_confirmation' };
  }
  if (includesAny(query, ['转人工', '人工客服', '怎样联系', '如何联系', '确认合作日期', 'human support', 'contact a human', 'talk to a human', 'confirm partnership date'])) {
    return { decision: 'handoff' as const, ids: ['kb-human-handoff'], reason: 'user_requested_handoff' };
  }
  return null;
}

function refusalAnswer(entries: KnowledgeEntry[], language: AssistantLanguage) {
  const boundary = entries[0]
    ? entryAnswer(entries[0], language)
    : language === 'en' ? 'This request is outside what AI support can confirm.' : '这个请求超出 AI 客服可确认的范围。';
  return language === 'en'
    ? `Sorry, I cannot make that promise or perform that action. ${boundary} Please use human support to confirm specific partnership terms.`
    : `抱歉，我不能按这个请求作出承诺或执行操作。${boundary}如需确认具体合作条件，请转人工处理。`;
}

function handoffAnswer(entries: KnowledgeEntry[], reason: string, language: AssistantLanguage) {
  const known = entries.map((entry) => entryAnswer(entry, language)).join('\n');
  const prefix = language === 'en'
    ? reason === 'user_requested_handoff'
      ? 'Yes—I can direct you to human partnership support.'
      : 'This information is time-sensitive or not sufficiently supported by current evidence, so I cannot confirm it for the platform.'
    : reason === 'user_requested_handoff'
      ? '可以，我为你提供人工合作咨询入口。'
      : '这项信息具有时效性或当前知识库证据不足，我不能替平台确认。';
  return `${prefix}${known ? `\n${known}` : ''}`;
}

function groundedAnswer(entries: KnowledgeEntry[], language: AssistantLanguage) {
  return entries.map((entry) => entryAnswer(entry, language)).join('\n\n');
}

function publicEventOverviewAnswer(query: string, language: AssistantLanguage) {
  const isGenesisHackathon = includesAny(query, ['genesis']) && includesAny(query, ['黑客松', 'hackathon']);
  if (language === 'en') {
    return isGenesisHackathon
      ? 'Genesis Hackathon usually refers to a hackathon branded around “Genesis”: teams build and submit prototypes, demos, smart contracts, or apps within a defined theme and timeline, then go through review, demo, and possible awards or incubation. “Genesis” can be used by different organizers, so the exact host, tracks, eligibility, deadlines, prizes, compute, and investment terms depend on the specific official event page.'
      : 'A hackathon is a time-bounded builder event where participants form teams, build a prototype or demo around a theme, submit it for judging, and may receive feedback, awards, ecosystem support, or incubation. Exact rules depend on the official event page.';
  }
  return isGenesisHackathon
    ? 'Genesis 黑客松通常指以 “Genesis” 为活动名或主题的黑客松：参赛者围绕指定赛道，在限定时间内组队完成原型、Demo、智能合约或应用，并提交给评委评审，可能包含路演、奖励、生态支持或孵化机会。“Genesis” 可能被不同主办方使用，所以具体主办方、赛道、报名资格、截止时间、奖金、算力和投资条款，需要看对应活动的官方页面。'
    : '黑客松是一种限时创新/开发活动：参与者围绕主题组队做原型或 Demo，按规则提交作品并接受评审，可能获得反馈、奖励、生态资源或后续孵化。具体规则要以对应活动官方页面为准。';
}

function buildContext(entries: KnowledgeEntry[], language: AssistantLanguage) {
  return entries.map((entry, index) => [
    `[S${index + 1}] ${entry.title}`,
    entryAnswer(entry, language),
    language === 'en'
      ? `Source: ${entry.source.label} (checked ${entry.source.checkedAt})`
      : `来源：${entry.source.label}（核验于 ${entry.source.checkedAt}）`,
    language === 'en'
      ? `Valid from ${entry.validFrom} to ${entry.validUntil}`
      : `有效期：${entry.validFrom} 至 ${entry.validUntil}`,
  ].join('\n')).join('\n\n');
}

export function retrieveAssistantKnowledge(
  query: string,
  audience: AssistantAudience,
  language: AssistantLanguage = 'zh',
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
        ? refusalAnswer(entries, language)
        : handoffAnswer(entries, policy.reason, language),
      citations: entries.map(toCitation),
      knowledgeAsOf: knowledgeBundle.reviewedAt,
      handoffRequired: true,
      handoffReason: policy.reason,
      context: buildContext(entries, language),
    };
  }

  const htxGenesisEntries = isHtxGenesisHackathonQuestion(query)
    ? findByIds(['kb-htx-genesis-hackathon'], currentEntries)
    : [];
  if (htxGenesisEntries.length > 0) {
    return {
      decision: 'answer',
      answer: groundedAnswer(htxGenesisEntries, language),
      citations: htxGenesisEntries.map(toCitation),
      knowledgeAsOf: knowledgeBundle.reviewedAt,
      handoffRequired: false,
      handoffReason: null,
      context: buildContext(htxGenesisEntries, language),
    };
  }

  if (isPublicEventOverviewQuestion(query)) {
    return {
      decision: 'answer',
      answer: publicEventOverviewAnswer(query, language),
      citations: [],
      knowledgeAsOf: knowledgeBundle.reviewedAt,
      handoffRequired: false,
      handoffReason: null,
      context: '',
    };
  }

  const intentEntries = isPlatformOverviewQuestion(query)
    ? findByIds(['kb-platform-overview'], currentEntries)
    : [];
  const gettingStartedEntries = matchesStandaloneIntent(query, GETTING_STARTED_INTENTS)
    ? findByIds(['kb-getting-started'], currentEntries)
    : [];
  const publicEventLookupEntries = includesAny(query, PUBLIC_EVENT_LOOKUP_INTENTS) && includesAny(query, PUBLIC_EVENT_LOOKUP_SUBJECTS)
    ? findByIds(['kb-hackathon-support', 'kb-public-event-search'], currentEntries)
    : [];
  const scoredEntries = currentEntries
    .map((entry) => ({ entry, score: scoreEntry(query, entry, audience) }))
    .filter((item) => item.score >= 4)
    .sort((a, b) => b.score - a.score || a.entry.id.localeCompare(b.entry.id))
    .slice(0, MAX_RESULTS)
    .map((item) => item.entry);
  const ranked = uniqueEntries([
    ...intentEntries,
    ...gettingStartedEntries,
    ...publicEventLookupEntries,
    ...scoredEntries,
  ]).slice(0, publicEventLookupEntries.length > 0 ? publicEventLookupEntries.length : MAX_RESULTS);

  if (ranked.length === 0) {
    const staleMatch = approvedEntries.some((entry) => !isCurrent(entry, today) && scoreEntry(query, entry, audience) >= 4);
    if (!staleMatch) {
      // unknown_question is intentionally allowed through to the general AI path.
      return {
        decision: 'answer',
        answer: language === 'en'
          ? 'I can help with general questions. For platform-specific facts that are not in the reviewed knowledge base, I will clearly label uncertainty instead of inventing details.'
          : '我可以回答一般问题。对于审核知识库中没有的平台具体事实，我会明确说明不确定，而不会编造信息。',
        citations: [],
        knowledgeAsOf: knowledgeBundle.reviewedAt,
        handoffRequired: false,
        handoffReason: null,
        context: '',
      };
    }
    const handoffEntries = findByIds(['kb-human-handoff'], currentEntries);
    return {
      decision: 'handoff',
      answer: language === 'en'
        ? 'The relevant knowledge has expired, so I cannot continue to cite it. Please use human partnership support to confirm the latest information.'
        : '相关知识条目已过期，我不能继续引用。请通过人工合作咨询确认最新信息。',
      citations: handoffEntries.map(toCitation),
      knowledgeAsOf: knowledgeBundle.reviewedAt,
      handoffRequired: true,
      handoffReason: 'stale_knowledge',
      context: buildContext(handoffEntries, language),
    };
  }

  const hasConflict = ranked.some((entry, index) => ranked
    .slice(index + 1)
    .some((candidate) => candidate.title === entry.title && candidate.answer !== entry.answer));
  if (hasConflict) {
    return {
      decision: 'handoff',
      answer: language === 'en'
        ? 'The reviewed knowledge base contains conflicting information, so I cannot choose one version. Please ask a human to confirm.'
        : '审核知识库存在冲突信息，我不能选择其中一个版本。请转人工确认。',
      citations: ranked.map(toCitation),
      knowledgeAsOf: knowledgeBundle.reviewedAt,
      handoffRequired: true,
      handoffReason: 'conflicting_knowledge',
      context: buildContext(ranked, language),
    };
  }

  return {
    decision: 'answer',
    answer: groundedAnswer(ranked, language),
    citations: ranked.map(toCitation),
    knowledgeAsOf: knowledgeBundle.reviewedAt,
    handoffRequired: false,
    handoffReason: null,
    context: buildContext(ranked, language),
  };
}

export function answerPassesGuardrails(answer: string) {
  const normalized = normalize(answer);
  const forbiddenPatterns = [
    /保证.{0,10}(奖金|算力|投资|嘉宾|曝光|主办|回复|收益|结果)/,
    /(稳赚|保本|一定获奖|一定回复|一定出席)/,
    /guarantee.{0,30}(prize|compute|investment|guest|exposure|host|reply|return|result)/,
    /(riskfree|guaranteedreturn|certaintowin|definitelyreply)/,
  ];
  return !forbiddenPatterns.some((pattern) => pattern.test(normalized));
}

export const assistantHandoffUrl = HANDOFF_URL;
