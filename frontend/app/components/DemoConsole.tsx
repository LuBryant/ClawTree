'use client';

import { useEffect, useMemo, useState } from 'react';
import { useLanguage } from '../i18n/LanguageProvider';

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
  workspace: { id: string; slug: string; name: string; nameEn: string; role: string };
  signals: Signal[]; targets: Target[]; campaign: Campaign; themePackage: ThemePackage;
  reply: { intent: string; confidence: number; summary: string; nextAction: string; isMock: boolean };
  funnel: Record<string, number>;
};
type Draft = {
  id: string; workspaceId: string; status: string; targetId: string; subject: string; body: string;
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
  const { tx } = useLanguage();
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
        method: 'POST', body: JSON.stringify({ workspaceId: data.workspace.id, campaignId: data.campaign.id, targetId: selectedTarget }),
      });
      setDraft(result);
    } catch (reason) { setError(reason instanceof Error ? reason.message : tx('生成失败', 'Generation failed')); }
    finally { setBusy(''); }
  }

  async function approveDraft() {
    if (!draft) return;
    setBusy('approve'); setError('');
    try {
      const result = await api<{ status: string }>('/api/outreach/approve', {
        method: 'POST', body: JSON.stringify({ draftId: draft.id, approvedBy: `${data?.workspace.nameEn || 'Demo'} Operator` }),
      });
      setSent(result.status === 'simulated_sent');
      setDraft({ ...draft, status: result.status });
    } catch (reason) { setError(reason instanceof Error ? reason.message : tx('批准失败', 'Approval failed')); }
    finally { setBusy(''); }
  }

  async function anchorProof() {
    if (!data || !draft || !sent) return;
    setBusy('proof'); setError('');
    try {
      setProof(await api<Proof>('/api/proofs/anchor', {
        method: 'POST', body: JSON.stringify({ workspaceId: data.workspace.id, campaignId: data.campaign.id, draftId: draft.id }),
      }));
    } catch (reason) { setError(reason instanceof Error ? reason.message : tx('凭证生成失败', 'Proof generation failed')); }
    finally { setBusy(''); }
  }

  if (busy === 'loading') return <main className="shell demo-loading">{tx('正在装载离线 Demo…', 'Loading offline demo…')}</main>;
  if (!data) return <main className="shell demo-loading error-box">{error || tx('Demo 数据不可用', 'Demo data unavailable')}</main>;

  return (
    <main className="shell demo-shell">
      <header className="demo-titlebar">
        <div>
          <span className="console-kicker">CLAWTREE PLATFORM / {data.workspace.nameEn.toUpperCase()} CAMPUS TOUR / DEMO CASE</span>
          <h1>{tx('全球足球赛事', 'Global Football')} <em>×</em> {tx('广州高校行', 'Guangzhou Campus Tour')}</h1>
          <p className="demo-deck">{tx('把一次热点，变成一堂课、一场 Agent 挑战、五次传播和一份可验证影响力资产。', 'Turn one global moment into a class, an Agent challenge, five media beats, and a verifiable impact asset.')}</p>
        </div>
        <div className="safe-mode"><span /> {tx('零外部副作用', 'Zero external side effects')}</div>
      </header>

      <p className="demo-notice">{data.meta.notice}</p>
      {error && <div className="error-box" role="alert">{error}</div>}

      <nav className="story-rail" aria-label={tx('现场 Demo 叙事路径', 'Live demo journey')}>
        {[tx('可信信号', 'Trusted signals'), tx('主题设计', 'Theme design'), tx('高校匹配', 'Campus match'), tx('人工审批', 'Human approval'), tx('影响凭证', 'Impact proof')].map((step, index) => (
          <span key={step}><b>{String(index + 1).padStart(2, '0')}</b>{step}</span>
        ))}
      </nav>

      <section className="funnel-grid" aria-label={tx('Campaign 漏斗', 'Campaign funnel')}>
        {[
          [tx('可信信号', 'Trusted signals'), data.funnel.signalsVerified], [tx('增长机会', 'Opportunities'), data.funnel.opportunities],
          [tx('候选高校', 'Campus targets'), data.funnel.targetsShortlisted], [tx('正向回复', 'Positive replies'), data.funnel.positiveReplies],
        ].map(([label, value]) => <div key={label}><strong>{value}</strong><span>{label}</span></div>)}
      </section>

      <section className="theme-package" aria-labelledby="theme-package-title">
        <div className="section-label-row">
          <div>
            <span>THEME PACKAGE / READY TO RUN</span>
            <h2 id="theme-package-title">{tx('热点不是噱头，而是教学与传播的共同引擎', 'A trend is not a gimmick—it can power both learning and distribution')}</h2>
          </div>
          <div className="local-topic-row" aria-label={tx('广州在地议题', 'Guangzhou local topics')}>
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
            <div className="rubric-list" aria-label={tx('挑战评分规则', 'Challenge rubric')}>
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
          <div className="panel-title"><span>03</span><div><h2>Signal Inbox</h2><p>{tx('事实来自哪里，一眼可查', 'See where every fact comes from')}</p></div></div>
          <div className="signal-list">
            {data.signals.map((signal) => (
              <article className="signal-card" key={signal.id}>
                <div className="signal-meta"><span className="verified">✓ {tx('已核验', 'Verified')}</span><time>{signal.publishedAt.slice(0, 10)}</time></div>
                <h3>{signal.title}</h3><p>{signal.summary}</p>
                <div className="tag-row">{signal.tags.slice(0, 3).map((tag) => <span key={tag}>{tag}</span>)}</div>
                <a href={signal.url} target="_blank" rel="noreferrer">{signal.publisher} ↗</a>
              </article>
            ))}
          </div>
        </section>

        <section className="console-panel campaign-panel">
          <div className="panel-title"><span>04</span><div><h2>Opportunity Brief</h2><p>{tx('Agent 推断，与事实分层展示', 'Agent inferences are separated from facts')}</p></div></div>
          <span className="inference-label">{tx('AI 建议 · 待人审', 'AI suggestion · Human review required')}</span>
          <h3 className="campaign-name">{data.campaign.name}</h3>
          <p className="campaign-angle">{data.campaign.angle}</p>
          <dl className="brief-list">
            <div><dt>{tx('目标', 'Goal')}</dt><dd>{data.campaign.objective}</dd></div>
            <div><dt>{tx('形式', 'Formats')}</dt><dd>{data.campaign.formats.join(' / ')}</dd></div>
            <div><dt>{tx('引用', 'Citations')}</dt><dd>{data.campaign.signalIds.length} {tx('条已核验信号', 'verified signals')}</dd></div>
          </dl>

          <div className="panel-title compact"><span>05</span><div><h2>Target Match</h2><p>{tx('5 所高校 · 每校 2 条公开证据', '5 campuses · 2 public evidence points each')}</p></div></div>
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
              <div><span>{tx('推荐共创', 'Recommended collaboration')}</span><strong>{selected.recommendedFormat}</strong></div>
              <p>{selected.reasons.slice(0, 2).join('；')}。</p>
              <div className="evidence-links">
                {selected.evidence.map((item, index) => (
                  <a key={item.url} href={item.url} target="_blank" rel="noreferrer">{tx('证据', 'Evidence')} {index + 1} · {item.label} ↗</a>
                ))}
              </div>
            </aside>
          )}
          <button className="action-button" onClick={generateDraft} disabled={Boolean(busy)}>
            {busy === 'draft' ? tx('Agent 正在生成…', 'Agent is drafting…') : tx(`为 ${selected?.organization || '目标'} 生成外联草稿`, `Generate outreach draft for ${selected?.organization || 'target'}`)}
          </button>
        </section>

        <section className="console-panel action-panel">
          <div className="panel-title"><span>06</span><div><h2>Human Gate + Proof</h2><p>{tx('每个真实副作用都要过人审', 'Every real-world side effect requires human approval')}</p></div></div>
          {!draft ? (
            <div className="empty-state"><strong>{tx('等待草稿', 'Waiting for a draft')}</strong><p>{tx('先选择目标并启动 Agent。系统不会真的发送邮件。', 'Choose a target and start the Agent. No email will actually be sent.')}</p></div>
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
                  {busy === 'approve' ? tx('记录审批…', 'Recording approval…') : tx('人工批准并模拟发送', 'Approve and simulate send')}
                </button>
              ) : (
                <div className="reply-card">
                  <span>MOCK REPLY · {Math.round(data.reply.confidence * 100)}% {data.reply.intent}</span>
                  <strong>{data.reply.summary}</strong><p>{tx('建议', 'Suggested next step')}: {data.reply.nextAction}</p>
                </div>
              )}
              {sent && !proof && <button className="proof-button" onClick={anchorProof} disabled={Boolean(busy)}>{busy === 'proof' ? tx('生成规范化哈希…', 'Generating canonical hash…') : tx('生成链上凭证（Mock Nile）', 'Generate onchain proof (Mock Nile)')}</button>}
              {proof && (
                <div className="proof-card"><span>PROOF ANCHORED · MOCK</span><strong>{proof.network}</strong><code>{proof.payloadHash}</code><small>{tx('仅包含 campaign、来源 ID 与审批状态；不含联系人和邮件正文。', 'Contains only campaign, source IDs, and approval status—never contacts or email content.')}</small></div>
              )}
            </>
          )}
        </section>
      </div>

      <section className="impact-section" aria-labelledby="impact-title">
        <div className="section-label-row">
          <div><span>CAMPAIGN AFTERLIFE</span><h2 id="impact-title">{tx('一场活动，留下五次传播与长期资产', 'One event, five media beats, and a lasting asset')}</h2></div>
          <p>{tx('不是“办完即结束”。每个节点都由公开事实、人审状态和可审计指标驱动。', 'The campaign does not end when the event does. Public facts, human approvals, and auditable metrics power every stage.')}</p>
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
            <div className="subsection-heading"><span>3-TIER PARTNERSHIP</span><h3>{tx('三档合作，不做空泛赞助权益', 'Three concrete partnership tiers')}</h3></div>
            <div className="sponsor-tier-list">
              {data.themePackage.sponsorTiers.map((tier) => (
                <article key={tier.name}><span>{tier.name}</span><strong>{tier.price}</strong><p>{tier.deliverables}</p></article>
              ))}
            </div>
          </div>

          <div className="passport-panel">
            <div><span>IMPACT PASSPORT / PRIVACY-SAFE</span><h3>{tx('让投资人与赞助方看见可验证结果', 'Give investors and sponsors verifiable outcomes')}</h3></div>
            <div className="passport-metrics">
              {data.themePackage.impactMetrics.map((metric, index) => (
                <span key={metric}><b>0{index + 1}</b>{metric}</span>
              ))}
            </div>
            <small>{tx('仅锚定活动摘要与审批状态哈希；联系人、邮件正文和个人信息永不上链。', 'Only event summaries and approval-state hashes are anchored. Contacts, email content, and personal data always stay offchain.')}</small>
          </div>
        </div>
      </section>
    </main>
  );
}
