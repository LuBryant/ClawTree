export type WorkspaceCapability = {
  id: string;
  title: string;
  titleEn: string;
  sourceIds: string[];
  owner: string;
  validUntil: string;
  approved: boolean;
  boundary: string;
  boundaryEn: string;
};

export type WorkspaceProfile = {
  id: string;
  slug: string;
  name: string;
  nameEn: string;
  initials: string;
  status: 'demo' | 'sandbox';
  industries: string[];
  mission: string;
  missionEn: string;
  publicPortalTitle: string;
  publicPortalTitleEn: string;
  outreachSignature: string;
  outreachSignatureEn: string;
  capabilities: WorkspaceCapability[];
};

export const PLATFORM_PROFILE = {
  name: 'ClawTree',
  nameZh: '树爪智动',
  category: 'AI Partnership Intelligence Network',
  categoryZh: 'AI 合作增长网络',
  promise: 'Turn public signals into trusted partnerships.',
  promiseZh: '把公共信号，变成可信合作。',
} as const;

export const WORKSPACES: Record<string, WorkspaceProfile> = {
  treefinance: {
    id: 'ws-treefinance',
    slug: 'treefinance',
    name: '大树财经',
    nameEn: 'TreeFinance',
    initials: 'TF',
    status: 'demo',
    industries: ['MEDIA', 'WEB3', 'CAMPUS'],
    mission: '连接 AI、Web3、财经媒体与高校创新生态。',
    missionEn: 'Connect AI, Web3, financial media, and campus innovation.',
    publicPortalTitle: '大树财经高校内容与合作门户',
    publicPortalTitleEn: 'TreeFinance Campus Content & Partnership Portal',
    outreachSignature: '大树财经高校行团队',
    outreachSignatureEn: 'TreeFinance Campus Team',
    capabilities: [
      {
        id: 'cap-media',
        title: '媒体支持与活动复盘',
        titleEn: 'Media support and event recaps',
        sourceIds: ['tf-profile-positioning', 'tf-nuist-recap'],
        owner: 'TreeFinance Content',
        validUntil: '2026-09-30',
        approved: true,
        boundary: '只承诺已批准的内容资源，不保证曝光量。',
        boundaryEn: 'Only approved content resources may be offered; reach is never guaranteed.',
      },
      {
        id: 'cap-space',
        title: 'X Space / 圆桌联动',
        titleEn: 'X Space / roundtable collaboration',
        sourceIds: ['tf-ai-data-ama'],
        owner: 'TreeFinance Ops',
        validUntil: '2026-08-31',
        approved: true,
        boundary: '嘉宾、时间和主题需单独人工确认。',
        boundaryEn: 'Guests, timing, and topics require separate human confirmation.',
      },
      {
        id: 'cap-hackathon',
        title: 'AI×Web3 黑客松与项目招募',
        titleEn: 'AI × Web3 hackathons and project scouting',
        sourceIds: ['tf-htx-waic'],
        owner: 'TreeFinance Ecosystem',
        validUntil: '2026-07-31',
        approved: true,
        boundary: '不承诺未批准奖金、投资或主办身份。',
        boundaryEn: 'No unapproved prizes, investment, or host status may be promised.',
      },
    ],
  },
  'campus-lab': {
    id: 'ws-campus-lab',
    slug: 'campus-lab',
    name: 'Campus Lab',
    nameEn: 'Campus Lab',
    initials: 'CL',
    status: 'sandbox',
    industries: ['UNIVERSITY', 'COMMUNITY'],
    mission: '展示高校创新组织如何复用同一套合作增长引擎。',
    missionEn: 'Show how campus innovation groups can reuse the same partnership engine.',
    publicPortalTitle: 'Campus Lab 合作门户（沙盒）',
    publicPortalTitleEn: 'Campus Lab Partnership Portal (Sandbox)',
    outreachSignature: 'Campus Lab 合作团队',
    outreachSignatureEn: 'Campus Lab Partnerships',
    capabilities: [],
  },
};

export const DEMO_WORKSPACE = WORKSPACES.treefinance;

export function getWorkspace(slug?: string) {
  if (!slug) return DEMO_WORKSPACE;
  return WORKSPACES[slug];
}
