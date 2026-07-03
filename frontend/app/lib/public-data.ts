import demo from '../../data/demo.json';
import golden from '../../data/golden-gate.json';

type GoldenContentItem = (typeof golden.contentItems)[number];
type GoldenEvent = (typeof golden.campusEvents)[number];
type ProposalTarget = (typeof golden.proposalTargets)[number];

const shortDate = new Intl.DateTimeFormat('zh-CN', {
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

export const userIa = [
  { href: '/user', label: '首页' },
  { href: '/user/signals', label: 'Signals' },
  { href: '/user/events', label: 'Events' },
  { href: '/user/recaps', label: 'Recaps' },
  { href: '/user/about', label: 'About' },
  { href: '/user/cooperate', label: 'Cooperate' },
];

function formatDate(value: string) {
  return shortDate.format(new Date(value));
}

function labelsOf(item: GoldenContentItem) {
  return item.expected.labels.filter((label) => label !== 'treefinance');
}

function summaryFor(item: GoldenContentItem) {
  if (item.id === 'tf-guangzhou-campus') {
    return '广州站高校行公开信号已进入内容接力站：保留来源、发布时间、抓取时间和编辑状态，适合作为老师侧入口。';
  }
  if (item.id === 'tf-nuist-recap') {
    return '南信大高校行复盘可作为可信回顾样本，公开端只展示摘要、来源和编辑说明，不复制未授权全文。';
  }
  if (item.id === 'tf-ai-data-ama') {
    return 'AI 数据资产与确权话题适合转成高校公开课/工作坊素材，但必须保持教育语境并经人工审核。';
  }
  if (item.id === 'tf-worldcup-market') {
    return '世界杯只作为公共事件与财经素养案例，页面明确无博彩、无荐股、无收益或结果保证。';
  }
  return '该公开来源已纳入黄金集，可用于内容分类、合规审核、合作提案引用和后续人工发布。';
}

export const publicSignals = demo.signals.map((signal) => ({
  ...signal,
  publishedDate: formatDate(signal.publishedAt),
  fetchedDate: formatDate(signal.fetchedAt),
  boundary: signal.kind === 'sports' ? '教育内容，不构成投资建议或结果预测' : '公开事实，AI 仅做摘要与归类',
}));

export const publicRecaps = golden.contentItems
  .filter((item) => item.publicDisplayAllowed && item.expected.publishableAfterReview)
  .map((item) => ({
    id: item.id,
    slug: item.id,
    title: item.title,
    sourceUrl: item.sourceUrl,
    publishedAt: item.publishedAt,
    fetchedAt: item.fetchedAt,
    publishedDate: formatDate(item.publishedAt),
    fetchedDate: formatDate(item.fetchedAt),
    summary: summaryFor(item),
    tags: labelsOf(item),
    riskLevel: item.expected.risk,
    editorialStatus: 'approved_fixture',
    editorNote: item.expected.risk === 'high'
      ? '高风险主题仅允许教育化摘要，禁止博彩、荐股、收益承诺和结果保证。'
      : '已通过离线黄金集审核；真实发布仍需编辑二次确认。',
  }));

function publicEventStatus(event: GoldenEvent) {
  if (event.expected.credibility === 'high') return '已核验';
  if (event.expected.credibility === 'medium') return '待复核';
  return '不公开';
}

export const publicEvents = golden.campusEvents
  .filter((event) => event.expected.publicUserVisible)
  .map((event) => ({
    id: event.id,
    title: event.title.replace('（黄金样本）', ''),
    city: event.city,
    startsAt: event.startsAt,
    startsDate: formatDate(event.startsAt),
    sourceUrl: event.sourceUrl,
    sourceLabel: event.fixtureOnly ? '离线黄金样本' : '公开来源',
    status: publicEventStatus(event),
    credibility: event.expected.credibility,
    tags: event.expected.proposalFocus,
    registrationUrl: '/demo',
    publicNote: '公开端不展示联系邮箱、联系页证据、内部评分或未核验原文。',
  }));

export const capabilityLibrary = [
  {
    id: 'cap-media',
    title: '媒体支持与活动复盘',
    sourceIds: ['tf-profile-positioning', 'tf-nuist-recap'],
    owner: 'TreeFinance Content',
    validUntil: '2026-09-30',
    approved: true,
    boundary: '只承诺已批准的内容资源，不保证曝光量。',
  },
  {
    id: 'cap-space',
    title: 'X Space / 圆桌联动',
    sourceIds: ['tf-ai-data-ama'],
    owner: 'TreeFinance Ops',
    validUntil: '2026-08-31',
    approved: true,
    boundary: '嘉宾、时间和主题需单独人工确认。',
  },
  {
    id: 'cap-hackathon',
    title: 'AI×Web3 黑客松与项目招募',
    sourceIds: ['tf-htx-waic'],
    owner: 'TreeFinance Ecosystem',
    validUntil: '2026-07-31',
    approved: true,
    boundary: '不承诺未批准奖金、投资或主办身份。',
  },
];

export const ingestionRuns = [
  {
    id: 'run-x-20260703',
    connector: 'TreeFinance X',
    platform: 'x',
    status: 'succeeded',
    cursorBefore: '2065003624980455715',
    cursorAfter: '2071559653612552638',
    collected: 10,
    added: 4,
    duplicates: 2,
    failed: 0,
    cost: '¥0.18',
    duration: '41s',
    owner: 'Content Relay',
  },
  {
    id: 'run-campus-20260703',
    connector: 'Campus Opportunity Radar',
    platform: 'campus',
    status: 'needs_review',
    cursorBefore: '2026-07-02',
    cursorAfter: '2026-07-03',
    collected: 10,
    added: 4,
    duplicates: 1,
    failed: 3,
    cost: '¥0.00 fixture',
    duration: '9s',
    owner: 'Ops',
  },
];

export const contentReviewQueue = publicRecaps.map((recap, index) => ({
  ...recap,
  clusterKey: index === 3 ? 'sports-worldcup-event-driven' : `cluster-${recap.id}`,
  duplicateReason: index === 3 ? '与世界杯备用样本相似，保留主稿并合并来源。' : '无跨源重复。',
  diffSummary: recap.riskLevel === 'high'
    ? '删除“预测/结果保证”倾向表达，保留财经素养和数据验证语境。'
    : '保留事实、压缩摘要、补充编辑说明。',
  rawVisible: false,
}));

export const proposalTargets = golden.proposalTargets.map((target: ProposalTarget) => {
  const demoTarget = demo.targets.find((item) => item.id === target.id);
  return {
    id: target.id,
    organization: target.organization,
    city: target.city,
    score: demoTarget?.score ?? 82,
    reasons: demoTarget?.reasons ?? [],
    tiers: target.expected.proposalTierFocus,
    mustCite: target.expected.mustCite,
    mustNotPromise: target.expected.mustNotPromise,
    maskedEmail: `${target.id.replace('target-', 'demo-')}@***.invalid`,
    approvalStatus: target.id === 'target-gdufe' ? 'ready_for_review' : 'draft',
  };
});

export const outreachBatches = [
  {
    id: 'batch-guangzhou-demo',
    name: '广州高校行逐校提案草稿批次',
    status: 'draft_only',
    messages: proposalTargets.map((target) => ({
      id: `msg-${target.id}`,
      organization: target.organization,
      recipient: target.maskedEmail,
      proposalVersion: 'v1-fixture',
      idempotencyKey: `cmp-worldcup-guangzhou-2026:${target.id}:v1`,
      status: target.approvalStatus === 'ready_for_review' ? 'awaiting_human_approval' : 'draft',
      risk: target.mustNotPromise.join(', '),
    })),
    externalSideEffect: false,
    dailyLimit: 20,
    stopSwitch: true,
  },
];

export const agentRuns = [
  { id: 'agent-classify-001', task: 'classify', provider: 'deterministic-fallback', latency: '7ms', cost: '¥0', refs: ['tf-guangzhou-campus'], status: 'succeeded' },
  { id: 'agent-compliance-001', task: 'compliance', provider: 'deterministic-fallback', latency: '9ms', cost: '¥0', refs: ['tf-worldcup-market'], status: 'needs_review' },
  { id: 'agent-proposal-001', task: 'proposal', provider: 'deterministic-fallback', latency: '11ms', cost: '¥0', refs: ['tf-guangzhou-campus', 'tf-ai-data-ama'], status: 'succeeded' },
];

export const proofEvidence = {
  network: 'mock-tron-nile',
  payloadAllowlist: ['payloadVersion', 'campaignId', 'draftId', 'signalIds', 'approvalStatus'],
  forbidden: ['email', 'contact', 'body', 'reply', 'name', 'prompt'],
};
