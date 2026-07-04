'use client';

import { useEffect, useMemo, useState } from 'react';

type Signal = {
  id: string; title: string; summary: string; publisher: string; url: string;
  publishedAt: string; verification: string; confidence: number; tags: string[];
};
type Target = {
  id: string; organization: string; score: number; reasons: string[];
  focus: string; recommendedFormat: string; evidence: { label: string; url: string }[];
  contact: { email: string; isMock: boolean };
};
type Campaign = {
  id: string; name: string; objective: string; angle: string; formats: string[]; localTopics: string[]; signalIds: string[];
};
type ThemePackage = {
  course: { title: string; duration: string; promise: string; modules: string[] };
  challenge: {
    title: string; phases: string[];
    rubric: { label: string; weight: number }[];
  };
  mediaPlan: { stage: string; timing: string; asset: string }[];
  sponsorTiers: { name: string; price: string; deliverables: string }[];
  impactMetrics: string[];
  guardrails: string[];
};
type DemoData = {
  meta: { mode: string; notice: string };
  signals: Signal[]; targets: Target[]; campaign: Campaign; themePackage: ThemePackage;
  reply: { intent: string; confidence: number; summary: string; nextAction: string; isMock: boolean };
  funnel: Record<string, number>;
};
type Draft = {
  id: string; status: string; targetId: string; subject: string; body: string;
  personalization: string[]; citationIds: string[];
  guardrailChecks: Record<string, boolean>; externalSideEffect: boolean;
};
type Proof = { network: string; payloadHash: string; txHash: string; isMock: boolean; privacyFields: string[] };

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    ...init,
    headers: { 'content-type': 'application/json', ...(init?.headers || {}) },
  });
  const payload = await response.json();
  if (!response.ok) throw new Error(payload?.error?.message || '请求失败');
  return payload;
}

export default function DemoConsole() {
  const [data, setData] = useState<DemoData | null>(null);
  const [selectedTarget, setSelectedTarget] = useState('');
  const [draft, setDraft] = useState<Draft | null>(null);
  const [sent, setSent] = useState(false);
  const [proof, setProof] = useState<Proof | null>(null);
  const [busy, setBusy] = useState('loading');
  const [error, setError] = useState('');

  useEffect(() => {
    api<DemoData>('/api/demo')
      .then((result) => {
        setData(result); setSelectedTarget(result.targets[0]?.id || ''); setBusy('');
      })
      .catch((reason) => { setError(reason.message); setBusy(''); });
  }, []);

  const selected = useMemo(
    () => data?.targets.find((target) => target.id === selectedTarget),
    [data, selectedTarget],
  );

  async function generateDraft() {
    if (!data || !selectedTarget) return;
    setBusy('draft'); setError(''); setSent(false); setProof(null);
    try {
      const result = await api<Draft>('/api/outreach/draft', {
        method: 'POST', body: JSON.stringify({ campaignId: data.campaign.id, targetId: selectedTarget }),
      });
      setDraft(result);
    } catch (reason) { setError(reason instanceof Error ? reason.message : '生成失败'); }
    finally { setBusy(''); }
  }

  async function approveDraft() {
    if (!draft) return;
    setBusy('approve'); setError('');
    try {
      const result = await api<{ status: string }>('/api/outreach/approve', {
        method: 'POST', body: JSON.stringify({ draftId: draft.id, approvedBy: 'TreeFinance Demo Operator' }),
      });
      setSent(result.status === 'simulated_sent');
      setDraft({ ...draft, status: result.status });
    } catch (reason) { setError(reason instanceof Error ? reason.message : '批准失败'); }
    finally { setBusy(''); }
  }

  async function anchorProof() {
    if (!data || !draft || !sent) return;
    setBusy('proof'); setError('');
    try {
      setProof(await api<Proof>('/api/proofs/anchor', {
        method: 'POST', body: JSON.stringify({ campaignId: data.campaign.id, draftId: draft.id }),
      }));
    } catch (reason) { setError(reason instanceof Error ? reason.message : '凭证生成失败'); }
    finally { setBusy(''); }
  }

  if (busy === 'loading') return <main className="shell demo-loading">正在装载离线 Demo…</main>;
  if (!data) return <main className="shell demo-loading error-box">{error || 'Demo 数据不可用'}</main>;

  return (
    <main className="shell demo-shell">
      <header className="demo-titlebar">
        <div>
          <span className="console-kicker">WORLD FOOTBALL 2026 / GUANGZHOU CAMPUS LAB</span>
          <h1>全球足球赛事 <em>×</em> 广州高校行</h1>
          <p className="demo-deck">把一次热点，变成一堂课、一场 Agent 挑战、五次传播和一份可验证影响力资产。</p>
        </div>
        <div className="safe-mode"><span /> 零外部副作用</div>
      </header>

      <p className="demo-notice">{data.meta.notice}</p>
      {error && <div className="error-box" role="alert">{error}</div>}

      <nav className="story-rail" aria-label="现场 Demo 叙事路径">
        {['可信信号', '主题设计', '高校匹配', '人工审批', '影响凭证'].map((step, index) => (
          <span key={step}><b>{String(index + 1).padStart(2, '0')}</b>{step}</span>
        ))}
      </nav>

      <section className="funnel-grid" aria-label="Campaign 漏斗">
        {[
          ['可信信号', data.funnel.signalsVerified], ['增长机会', data.funnel.opportunities],
          ['候选高校', data.funnel.targetsShortlisted], ['正向回复', data.funnel.positiveReplies],
        ].map(([label, value]) => <div key={label}><strong>{value}</strong><span>{label}</span></div>)}
      </section>

      <section className="theme-package" aria-labelledby="theme-package-title">
        <div className="section-label-row">
          <div>
            <span>THEME PACKAGE / READY TO RUN</span>
            <h2 id="theme-package-title">热点不是噱头，而是教学与传播的共同引擎</h2>
          </div>
          <div className="local-topic-row" aria-label="广州在地议题">
            {data.campaign.localTopics.map((topic) => <span key={topic}>{topic}</span>)}
          </div>
        </div>

        <div className="theme-card-grid">
          <article className="theme-card course-card">
            <div className="theme-card-top"><span>01 / PUBLIC CLASS</span><b>{data.themePackage.course.duration}</b></div>
            <h3>{data.themePackage.course.title}</h3>
            <p>{data.themePackage.course.promise}</p>
            <ol className="module-list">
              {data.themePackage.course.modules.map((module, index) => (
                <li key={module}><span>{String(index + 1).padStart(2, '0')}</span>{module}</li>
              ))}
            </ol>
          </article>

          <article className="theme-card challenge-card">
            <div className="theme-card-top"><span>02 / AGENT CHALLENGE</span><b>NO SCORE BETTING</b></div>
            <h3>{data.themePackage.challenge.title}</h3>
            <div className="challenge-phases">
              {data.themePackage.challenge.phases.map((phase) => <span key={phase}>{phase}</span>)}
            </div>
            <div className="rubric-list" aria-label="挑战评分规则">
              {data.themePackage.challenge.rubric.map((item) => (
                <div key={item.label}>
                  <span>{item.label}</span><i><b style={{ width: `${item.weight}%` }} /></i><strong>{item.weight}%</strong>
                </div>
              ))}
            </div>
          </article>
        </div>

        <div className="guardrail-band">
          <strong>CONTENT FIREWALL</strong>
          {data.themePackage.guardrails.map((item) => <span key={item}>✓ {item}</span>)}
        </div>
      </section>

      <div className="demo-grid">
        <section className="console-panel signals-panel">
          <div className="panel-title"><span>03</span><div><h2>Signal Inbox</h2><p>事实来自哪里，一眼可查</p></div></div>
          <div className="signal-list">
            {data.signals.map((signal) => (
              <article className="signal-card" key={signal.id}>
                <div className="signal-meta"><span className="verified">✓ 已核验</span><time>{signal.publishedAt.slice(0, 10)}</time></div>
                <h3>{signal.title}</h3><p>{signal.summary}</p>
                <div className="tag-row">{signal.tags.slice(0, 3).map((tag) => <span key={tag}>{tag}</span>)}</div>
                <a href={signal.url} target="_blank" rel="noreferrer">{signal.publisher} ↗</a>
              </article>
            ))}
          </div>
        </section>

        <section className="console-panel campaign-panel">
          <div className="panel-title"><span>04</span><div><h2>Opportunity Brief</h2><p>Agent 推断，与事实分层展示</p></div></div>
          <span className="inference-label">AI 建议 · 待人审</span>
          <h3 className="campaign-name">{data.campaign.name}</h3>
          <p className="campaign-angle">{data.campaign.angle}</p>
          <dl className="brief-list">
            <div><dt>目标</dt><dd>{data.campaign.objective}</dd></div>
            <div><dt>形式</dt><dd>{data.campaign.formats.join(' / ')}</dd></div>
            <div><dt>引用</dt><dd>{data.campaign.signalIds.length} 条已核验信号</dd></div>
          </dl>

          <div className="panel-title compact"><span>05</span><div><h2>Target Match</h2><p>5 所高校 · 每校 2 条公开证据</p></div></div>
          <div className="target-list">
            {data.targets.map((target) => (
              <button type="button" key={target.id} onClick={() => { setSelectedTarget(target.id); setDraft(null); setSent(false); setProof(null); }}
                aria-pressed={selectedTarget === target.id}
                className={selectedTarget === target.id ? 'target-card selected' : 'target-card'}>
                <span className="target-score">{target.score}</span>
                <span><strong>{target.organization}</strong><small>{target.focus}</small></span>
                <b>{target.contact.isMock ? 'FIT' : 'PUBLIC'}</b>
              </button>
            ))}
          </div>
          {selected && (
            <aside className="target-evidence">
              <div><span>推荐共创</span><strong>{selected.recommendedFormat}</strong></div>
              <p>{selected.reasons.slice(0, 2).join('；')}。</p>
              <div className="evidence-links">
                {selected.evidence.map((item, index) => (
                  <a key={item.url} href={item.url} target="_blank" rel="noreferrer">证据 {index + 1} · {item.label} ↗</a>
                ))}
              </div>
            </aside>
          )}
          <button className="action-button" onClick={generateDraft} disabled={Boolean(busy)}>
            {busy === 'draft' ? 'Agent 正在生成…' : `为 ${selected?.organization || '目标'} 生成外联草稿`}
          </button>
        </section>

        <section className="console-panel action-panel">
          <div className="panel-title"><span>06</span><div><h2>Human Gate + Proof</h2><p>每个真实副作用都要过人审</p></div></div>
          {!draft ? (
            <div className="empty-state"><strong>等待草稿</strong><p>先选择目标并启动 Agent。系统不会真的发送邮件。</p></div>
          ) : (
            <>
              <div className="draft-meta"><span>{draft.status}</span><small>{draft.citationIds.length} citations · {Object.values(draft.guardrailChecks).every(Boolean) ? 'guardrails passed' : 'needs review'}</small></div>
              <h3 className="draft-subject">{draft.subject}</h3>
              <pre className="draft-body">{draft.body}</pre>
              <div className="guardrail-list">
                {Object.entries(draft.guardrailChecks).map(([key, ok]) => <span key={key} className={ok ? 'pass' : 'fail'}>{ok ? '✓' : '!'} {key}</span>)}
              </div>
              {!sent ? (
                <button className="approve-button" onClick={approveDraft} disabled={Boolean(busy)}>
                  {busy === 'approve' ? '记录审批…' : '人工批准并模拟发送'}
                </button>
              ) : (
                <div className="reply-card">
                  <span>MOCK REPLY · {Math.round(data.reply.confidence * 100)}% {data.reply.intent}</span>
                  <strong>{data.reply.summary}</strong><p>建议：{data.reply.nextAction}</p>
                </div>
              )}
              {sent && !proof && <button className="proof-button" onClick={anchorProof} disabled={Boolean(busy)}>{busy === 'proof' ? '生成规范化哈希…' : '生成链上凭证（Mock Nile）'}</button>}
              {proof && (
                <div className="proof-card"><span>PROOF ANCHORED · MOCK</span><strong>{proof.network}</strong><code>{proof.payloadHash}</code><small>仅包含 campaign、来源 ID 与审批状态；不含联系人和邮件正文。</small></div>
              )}
            </>
          )}
        </section>
      </div>

      <section className="impact-section" aria-labelledby="impact-title">
        <div className="section-label-row">
          <div><span>CAMPAIGN AFTERLIFE</span><h2 id="impact-title">一场活动，留下五次传播与长期资产</h2></div>
          <p>不是“办完即结束”。每个节点都由公开事实、人审状态和可审计指标驱动。</p>
        </div>

        <div className="media-timeline">
          {data.themePackage.mediaPlan.map((item, index) => (
            <article key={item.timing}>
              <span>{item.timing}</span><b>{item.stage}</b><strong>{item.asset}</strong><i>{String(index + 1).padStart(2, '0')}</i>
            </article>
          ))}
        </div>

        <div className="impact-grid">
          <div className="sponsor-panel">
            <div className="subsection-heading"><span>3-TIER PARTNERSHIP</span><h3>三档合作，不做空泛赞助权益</h3></div>
            <div className="sponsor-tier-list">
              {data.themePackage.sponsorTiers.map((tier) => (
                <article key={tier.name}><span>{tier.name}</span><strong>{tier.price}</strong><p>{tier.deliverables}</p></article>
              ))}
            </div>
          </div>

          <div className="passport-panel">
            <div><span>IMPACT PASSPORT / PRIVACY-SAFE</span><h3>让投资人与赞助方看见可验证结果</h3></div>
            <div className="passport-metrics">
              {data.themePackage.impactMetrics.map((metric, index) => (
                <span key={metric}><b>0{index + 1}</b>{metric}</span>
              ))}
            </div>
            <small>仅锚定活动摘要与审批状态哈希；联系人、邮件正文和个人信息永不上链。</small>
          </div>
        </div>
      </section>
    </main>
  );
}
