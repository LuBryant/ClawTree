'use client';

import Link from 'next/link';
import { useLanguage } from './i18n/LanguageProvider';
import { DEMO_WORKSPACE, PLATFORM_PROFILE, WORKSPACES } from './config/workspaces';

export default function Home() {
  const { tx } = useLanguage();
  const steps = [
    ['01', tx('发现可信信号', 'Discover trusted signals'), tx('聚合高校、X、赛事与合作伙伴动态，每条事实保留来源和时间。', 'Aggregate campus, X, event, and partner updates with a source and timestamp for every fact.')],
    ['02', tx('生成增长机会', 'Generate growth opportunities'), tx('把广州高校行、世界杯热点与 AI×Web3 主题组合成可执行 campaign。', 'Turn Guangzhou campus tours, global football momentum, and AI × Web3 themes into executable campaigns.')],
    ['03', tx('人审外联', 'Human-reviewed outreach'), tx('匹配目标、生成个性化邀请；未经运营人员批准，Agent 不执行发送。', 'Match targets and draft personalized invitations. The Agent never sends without operator approval.')],
    ['04', tx('沉淀可验证结果', 'Create verifiable outcomes'), tx('回复进入统一漏斗，公共摘要哈希可锚定上链，隐私数据永不上链。', 'Route replies into one funnel and anchor public summary hashes onchain—never private data.')],
  ];
  return (
    <main>
      <section className="hero shell">
        <div className="eyebrow"><span className="live-dot" /> AI PARTNERSHIP INTELLIGENCE NETWORK</div>
        <h1>{tx('把公共信号，', 'Turn public signals')}<br /><em>{tx('变成可信合作。', 'into trusted partnerships.')}</em></h1>
        <p className="hero-copy">
          {tx(
            'ClawTree 为媒体、高校、活动方与 Web3 生态提供 AI 合作增长基础设施。15 分钟完成信号核验、机会设计、伙伴匹配与人审外联，并留下可审计的执行证据。',
            'ClawTree gives media, campuses, event teams, and Web3 ecosystems an AI-native partnership layer. In 15 minutes, verify signals, shape opportunities, match partners, review outreach, and retain an auditable trail.',
          )}
        </p>
        <div className="hero-actions">
          <Link href="/demo" className="primary-cta">{tx('开始 3 分钟 Demo', 'Start the 3-minute demo')} <span>→</span></Link>
          <span className="secondary-cta">{tx(`${DEMO_WORKSPACE.name} · 世界杯 ⨉ 广州高校行 · 演示案例`, `${DEMO_WORKSPACE.nameEn} · World Cup ⨉ Guangzhou campus tour · Demo case`)}</span>
        </div>
        <div className="hero-proof">
          <div><strong>70%+</strong><span>{tx('目标外联准备时间节省', 'less outreach prep time')}</span></div>
          <div><strong>15 min</strong><span>{tx('从可信信号到可审草稿', 'from trusted signal to reviewable draft')}</span></div>
          <div><strong>0 PII</strong><span>{tx('联系人与邮件内容不上链', 'contacts and email content kept offchain')}</span></div>
        </div>
      </section>

      <section className="shell section-block">
        <div className="section-heading">
          <span>ONE ENGINE / MANY WORKSPACES</span>
          <h2>{tx('ClawTree 是平台，这里用大树财经高校行作为演示案例', 'ClawTree is the platform. TreeFinance campus tour is used here as a demo case.')}</h2>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          {Object.values(WORKSPACES).map((workspace) => (
            <article className="panel p-6" key={workspace.id} style={{ opacity: workspace.status === 'sandbox' ? 0.72 : 1 }}>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <span className="brand-mark">{workspace.initials}</span>
                  <div>
                    <h3 className="text-xl font-black">{tx(workspace.name, workspace.nameEn)}</h3>
                    <p className="mt-1 text-xs" style={{ color: 'var(--muted)' }}>{workspace.industries.join(' · ')}</p>
                  </div>
                </div>
                <span className={workspace.status === 'demo' ? 'badge badge-success' : 'badge'}>
                  {workspace.status === 'demo' ? tx('演示案例', 'DEMO CASE') : tx('扩展示例', 'EXPANSION SANDBOX')}
                </span>
              </div>
              <p className="mt-5 text-sm leading-7" style={{ color: 'var(--text-dim)' }}>{tx(workspace.mission, workspace.missionEn)}</p>
              <p className="mt-4 text-xs font-bold" style={{ color: workspace.status === 'demo' ? 'var(--success)' : 'var(--muted)' }}>
                {workspace.status === 'demo'
                  ? tx(`${workspace.capabilities.length} 项已审核能力 · 演示案例数据`, `${workspace.capabilities.length} reviewed capabilities · demo case data`)
                  : tx('证明同一引擎可服务其他组织；不使用虚构业务数据', 'Proves engine portability without presenting fictional operating data')}
              </p>
            </article>
          ))}
        </div>
      </section>

      <section className="shell section-block">
        <div className="section-heading">
          <span>THE GOLDEN PATH</span>
          <h2>{tx('一个闭环，服务活动、内容与赞助增长', 'One closed loop for event, content, and sponsorship growth')}</h2>
        </div>
        <div className="step-grid">
          {steps.map(([number, title, copy]) => (
            <article className="step-card" key={number}>
              <span>{number}</span><h3>{title}</h3><p>{copy}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="shell audience-strip">
        <div><span>{PLATFORM_PROFILE.category.toUpperCase()}</span><strong>{tx('一套引擎，承载多个组织的合作工作区', 'One engine for many organizations and partnership workspaces')}</strong></div>
        <div><span>DEMO CASE · TREEFINANCE CAMPUS TOUR</span><strong>{tx('用高校行场景展示可复制、可验证的增长产品', 'Use campus tour scenarios to show a repeatable, verifiable growth product')}</strong></div>
        <Link href="/demo">{tx('进入 Demo Console', 'Open Demo Console')} →</Link>
      </section>
    </main>
  );
}
