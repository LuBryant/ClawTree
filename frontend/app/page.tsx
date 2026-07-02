import Link from 'next/link';

const steps = [
  ['01', '发现可信信号', '聚合高校、X、赛事与合作伙伴动态，每条事实保留来源和时间。'],
  ['02', '生成增长机会', '把广州高校行、世界杯热点与 AI×Web3 主题组合成可执行 campaign。'],
  ['03', '人审外联', '匹配目标、生成个性化邀请；未经运营人员批准，Agent 不执行发送。'],
  ['04', '沉淀可验证结果', '回复进入统一漏斗，公共摘要哈希可锚定上链，隐私数据永不上链。'],
];

export default function Home() {
  return (
    <main>
      <section className="hero shell">
        <div className="eyebrow"><span className="live-dot" /> AI × Web3 × MEDIA GROWTH</div>
        <h1>把热点和高校信号，<br /><em>变成真实合作。</em></h1>
        <p className="hero-copy">
          ClawTree 是大树财经的 AI 媒体活动增长操作系统。15 分钟完成信号核验、
          选题策划、目标匹配与个性化外联，并留下可审计的执行证据。
        </p>
        <div className="hero-actions">
          <Link href="/demo" className="primary-cta">开始 3 分钟 Demo <span>→</span></Link>
          <span className="secondary-cta">世界杯 × 广州高校行</span>
        </div>
        <div className="hero-proof">
          <div><strong>70%+</strong><span>目标外联准备时间节省</span></div>
          <div><strong>15 min</strong><span>从可信信号到可审草稿</span></div>
          <div><strong>0 PII</strong><span>联系人与邮件内容不上链</span></div>
        </div>
      </section>

      <section className="shell section-block">
        <div className="section-heading">
          <span>THE GOLDEN PATH</span>
          <h2>一个闭环，服务活动、内容与赞助增长</h2>
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
        <div><span>FOR TREEFINANCE</span><strong>把高校行做成可复制的增长产品</strong></div>
        <div><span>FOR SPONSORS</span><strong>看见从预算到高校合作的证据链</strong></div>
        <Link href="/demo">进入 Demo Console →</Link>
      </section>
    </main>
  );
}
