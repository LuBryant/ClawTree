'use client';

import Link from 'next/link';
import { useLanguage } from './i18n/LanguageProvider';

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
        <div className="eyebrow"><span className="live-dot" /> AI × Web3 × MEDIA GROWTH</div>
        <h1>{tx('把热点和高校信号，', 'Turn trends and campus signals')}<br /><em>{tx('变成真实合作。', 'into real partnerships.')}</em></h1>
        <p className="hero-copy">
          {tx(
            'ClawTree 是大树财经的 AI 媒体活动增长操作系统。15 分钟完成信号核验、选题策划、目标匹配与个性化外联，并留下可审计的执行证据。',
            'ClawTree is TreeFinance\'s AI-powered media and event growth OS. In 15 minutes, verify signals, shape a campaign, match partners, draft personalized outreach, and retain an auditable trail.',
          )}
        </p>
        <div className="hero-actions">
          <Link href="/demo" className="primary-cta">{tx('开始 3 分钟 Demo', 'Start the 3-minute demo')} <span>→</span></Link>
          <span className="secondary-cta">{tx('世界杯 × 广州高校行', 'Global Football × Guangzhou Campus Tour')}</span>
        </div>
        <div className="hero-proof">
          <div><strong>70%+</strong><span>{tx('目标外联准备时间节省', 'less outreach prep time')}</span></div>
          <div><strong>15 min</strong><span>{tx('从可信信号到可审草稿', 'from trusted signal to reviewable draft')}</span></div>
          <div><strong>0 PII</strong><span>{tx('联系人与邮件内容不上链', 'contacts and email content kept offchain')}</span></div>
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
        <div><span>FOR TREEFINANCE</span><strong>{tx('把高校行做成可复制的增长产品', 'Turn campus tours into a repeatable growth product')}</strong></div>
        <div><span>FOR SPONSORS</span><strong>{tx('看见从预算到高校合作的证据链', 'See the evidence trail from budget to campus partnership')}</strong></div>
        <Link href="/demo">{tx('进入 Demo Console', 'Open Demo Console')} →</Link>
      </section>
    </main>
  );
}
