'use client';

import { useEffect, useMemo, useState } from 'react';

type Signal = {
  id: string; title: string; summary: string; publisher: string; url: string;
  publishedAt: string; verification: string; confidence: number; tags: string[];
};
type Target = {
  id: string; organization: string; score: number; reasons: string[];
  contact: { email: string; isMock: boolean };
};
type Campaign = {
  id: string; name: string; objective: string; angle: string; formats: string[]; signalIds: string[];
};
type DemoData = {
  meta: { mode: string; notice: string };
  signals: Signal[]; targets: Target[]; campaign: Campaign;
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
        <div><span className="console-kicker">LIVE CAMPAIGN / MOCK MODE</span><h1>世界杯 × 广州高校行</h1></div>
        <div className="safe-mode"><span /> 零外部副作用</div>
      </header>

      <p className="demo-notice">{data.meta.notice}</p>
      {error && <div className="error-box" role="alert">{error}</div>}

      <section className="funnel-grid" aria-label="Campaign 漏斗">
        {[
          ['可信信号', data.funnel.signalsVerified], ['增长机会', data.funnel.opportunities],
          ['候选高校', data.funnel.targetsShortlisted], ['正向回复', data.funnel.positiveReplies],
        ].map(([label, value]) => <div key={label}><strong>{value}</strong><span>{label}</span></div>)}
      </section>

      <div className="demo-grid">
        <section className="console-panel signals-panel">
          <div className="panel-title"><span>01</span><div><h2>Signal Inbox</h2><p>事实来自哪里，一眼可查</p></div></div>
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
          <div className="panel-title"><span>02</span><div><h2>Opportunity Brief</h2><p>Agent 推断，与事实分层展示</p></div></div>
          <span className="inference-label">AI 建议 · 待人审</span>
          <h3 className="campaign-name">{data.campaign.name}</h3>
          <p className="campaign-angle">{data.campaign.angle}</p>
          <dl className="brief-list">
            <div><dt>目标</dt><dd>{data.campaign.objective}</dd></div>
            <div><dt>形式</dt><dd>{data.campaign.formats.join(' / ')}</dd></div>
            <div><dt>引用</dt><dd>{data.campaign.signalIds.length} 条已核验信号</dd></div>
          </dl>

          <div className="panel-title compact"><span>03</span><div><h2>Target Match</h2><p>选择一个高校生成草稿</p></div></div>
          <div className="target-list">
            {data.targets.map((target) => (
              <button type="button" key={target.id} onClick={() => { setSelectedTarget(target.id); setDraft(null); setSent(false); setProof(null); }}
                className={selectedTarget === target.id ? 'target-card selected' : 'target-card'}>
                <span className="target-score">{target.score}</span>
                <span><strong>{target.organization}</strong><small>{target.reasons[0]}</small></span>
                <b>{target.contact.isMock ? 'MOCK' : 'PUBLIC'}</b>
              </button>
            ))}
          </div>
          <button className="action-button" onClick={generateDraft} disabled={Boolean(busy)}>
            {busy === 'draft' ? 'Agent 正在生成…' : `为 ${selected?.organization || '目标'} 生成外联草稿`}
          </button>
        </section>

        <section className="console-panel action-panel">
          <div className="panel-title"><span>04</span><div><h2>Human Gate + Proof</h2><p>每个真实副作用都要过人审</p></div></div>
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
    </main>
  );
}
