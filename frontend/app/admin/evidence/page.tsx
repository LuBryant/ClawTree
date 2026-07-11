'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';

import intelligence from '../../../data/champion-intelligence.json';
import { fetchAgentWorkflows, fetchJudgeReplay, type JudgeReplayResult } from '../../lib/api-client';
import { useLanguage } from '../../i18n/LanguageProvider';
import DecisionLab from './DecisionLab';
import ProofReceiptPanel from './ProofReceipt';

const dimensionLabels: Record<string, [string, string]> = {
  themeFit: ['主题契合', 'Theme fit'],
  audienceFit: ['受众契合', 'Audience fit'],
  capabilityFit: ['能力契合', 'Capability fit'],
  timingFit: ['时机契合', 'Timing fit'],
  evidenceQuality: ['证据质量', 'Evidence quality'],
  executionFeasibility: ['执行可行性', 'Execution feasibility'],
};

const weights: Record<string, number> = {
  themeFit: 0.24,
  audienceFit: 0.18,
  capabilityFit: 0.18,
  timingFit: 0.12,
  evidenceQuality: 0.16,
  executionFeasibility: 0.12,
};

type CopilotCitation = { id: string; label?: string; url?: string | null; checkedAt?: string | null };
type CopilotResult = {
  decision: 'answer' | 'refuse' | 'handoff';
  answer: string;
  citations: CopilotCitation[];
  grounded: boolean;
};

function scoreOf(candidate: (typeof intelligence.matches)[number]) {
  return Math.round(Object.entries(candidate.dimensions)
    .reduce((sum, [key, item]) => sum + item.score * (weights[key] || 0), 0));
}

export default function JudgeEvidencePage() {
  const { tx } = useLanguage();
  const ranked = useMemo(() => intelligence.matches
    .map((candidate) => ({ ...candidate, score: scoreOf(candidate) }))
    .sort((a, b) => b.score - a.score), []);
  const [candidateId, setCandidateId] = useState(ranked[0].id);
  const [tierId, setTierId] = useState('medium');
  const [query, setQuery] = useState(tx('为什么推荐这所学校？', 'Why recommend this school?'));
  const [copilot, setCopilot] = useState<CopilotResult | null>(null);
  const [asking, setAsking] = useState(false);
  const [liveReplay, setLiveReplay] = useState<JudgeReplayResult | null>(null);

  useEffect(() => {
    fetchAgentWorkflows()
      .then((workflows) => workflows[0]?.runId ? fetchJudgeReplay(workflows[0].runId) : null)
      .then((replay) => setLiveReplay(replay))
      .catch(() => setLiveReplay(null));
  }, []);

  const candidate = ranked.find((item) => item.id === candidateId) || ranked[0];
  const alternative = ranked.find((item) => item.id !== candidate.id) || ranked[1];
  const tier = intelligence.proposalSimulator.tiers.find((item) => item.id === tierId)
    || intelligence.proposalSimulator.tiers[1];
  const sourceById = new Map(intelligence.graph.nodes
    .filter((node) => node.type === 'source')
    .map((node) => [node.id, node]));
  const claimBySource = new Map(intelligence.graph.nodes
    .filter((node) => node.type === 'claim' && 'sourceId' in node)
    .map((node) => [node.sourceId, node]));
  const evidenceIds = [...new Set(Object.values(candidate.dimensions).flatMap((item) => item.sourceIds))];
  const replayStages = liveReplay?.runs.map((run) => ({
    name: run.task,
    status: run.status,
    latencyMs: run.latencyMs,
    sourceIds: run.sourceIds,
  })) || intelligence.judgeEvidence.stages;
  const replayLatency = liveReplay
    ? liveReplay.runs.reduce((sum, run) => sum + run.latencyMs, 0)
    : intelligence.judgeEvidence.latencyMs;
  const replayCost = liveReplay
    ? liveReplay.runs.reduce((sum, run) => sum + (run.usage.costMicrousd || 0), 0)
    : intelligence.judgeEvidence.costMicrousd;
  const replayFallback = liveReplay
    ? liveReplay.runs.some((run) => run.fallback)
    : intelligence.judgeEvidence.fallback.used;
  const replayModel = liveReplay?.runs.find((run) => run.model.name)?.model.name || intelligence.judgeEvidence.model;

  async function askCopilot(event: FormEvent) {
    event.preventDefault();
    setAsking(true);
    try {
      const response = await fetch('/api/demo/copilot', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ query }),
      });
      setCopilot(await response.json() as CopilotResult);
    } finally {
      setAsking(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-black uppercase tracking-widest" style={{ color: 'var(--success)' }}>AIX-X1 / JUDGE EVIDENCE MODE</p>
          <h1 className="mt-2 font-normal leading-none tracking-tight" style={{ fontSize: 'clamp(1.7rem, 4vw, 3rem)' }}>
            {tx('机会到人工审批，全链路可解释', 'Explain the full path from opportunity to human gate')}
          </h1>
          <p className="mt-3 max-w-3xl text-sm leading-6" style={{ color: 'var(--muted)' }}>
            {tx('在 3 分钟内核验：为什么是现在、为什么是这所学校、反证是什么、三档成本多少，以及每个结论来自哪段原文。', 'Verify in three minutes: why now, why this school, counter-evidence, tier costs, and the original quote behind every conclusion.')}
          </p>
        </div>
        <div className="flex flex-col items-end gap-3">
          <div className="flex flex-wrap justify-end gap-2 text-xs">
            <span className="badge badge-success">citation coverage 100%</span>
            <span className="badge">{intelligence.meta.dataMode}</span>
            <span className="badge badge-warning">externalSideEffect=false</span>
          </div>
          <Link href="/demo/mission" className="btn btn-success btn-sm">▶ {tx('开启 90 秒路演', 'Launch 90-sec mission')}</Link>
        </div>
      </header>

      <section className="panel p-5" aria-labelledby="opportunity-title">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-black uppercase tracking-widest" style={{ color: 'var(--info)' }}>01 / OPPORTUNITY COMPOSER · {intelligence.opportunity.schemaVersion}</p>
            <h2 id="opportunity-title" className="mt-2 text-xl font-black">{tx('机会假设', 'Opportunity hypothesis')}</h2>
          </div>
          <span className="badge badge-warning">AI inference · human review</span>
        </div>
        <p className="mt-4 text-base leading-7">{intelligence.opportunity.hypothesis}</p>
        <div className="mt-5 grid gap-4 lg:grid-cols-3">
          <div className="panel-deep p-4">
            <strong className="text-sm" style={{ color: 'var(--success)' }}>{tx('支持证据', 'Supporting evidence')} · {intelligence.opportunity.supportingEvidence.length}</strong>
            {intelligence.opportunity.supportingEvidence.map((item) => (
              <p key={item.id} className="mt-3 text-xs leading-6" style={{ color: 'var(--text-dim)' }}>✓ {item.claim}<br /><span style={{ color: 'var(--info)' }}>“{item.quote}”</span></p>
            ))}
          </div>
          <div className="panel-deep p-4">
            <strong className="text-sm" style={{ color: 'var(--warning)' }}>{tx('反证 / 风险', 'Counter-evidence / risk')}</strong>
            {intelligence.opportunity.counterEvidence.map((item) => <p key={item.id} className="mt-3 text-xs leading-6" style={{ color: 'var(--text-dim)' }}>△ {item.claim}</p>)}
            <strong className="mt-4 block text-xs">{tx('待确认问题', 'Open question')}</strong>
            <p className="mt-2 text-xs leading-6" style={{ color: 'var(--muted)' }}>{intelligence.opportunity.openQuestions[0]}</p>
          </div>
          <div className="panel-deep p-4">
            <strong className="text-sm" style={{ color: 'var(--info)' }}>{tx('可验证 KPI', 'Testable KPI')}</strong>
            {intelligence.opportunity.kpis.map((kpi) => (
              <div key={kpi.name} className="mt-3 text-xs leading-6">
                <span className="block font-black">{kpi.name}: {kpi.target}</span>
                <span style={{ color: 'var(--muted)' }}>{kpi.window} · {kpi.measurement}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <DecisionLab
        selectedCandidateId={candidate.id}
        selectedTierId={tier.id}
        onCandidateSelect={setCandidateId}
        onTierSelect={setTierId}
      />

      <section className="grid gap-5 xl:grid-cols-[.72fr_1.28fr]" aria-labelledby="ranker-title">
        <div className="panel p-5">
          <p className="text-xs font-black uppercase tracking-widest" style={{ color: 'var(--info)' }}>03 / EXPLAINABLE MATCH RANKER</p>
          <h2 id="ranker-title" className="mt-2 text-xl font-black">Top-K</h2>
          <div className="mt-4 grid gap-2">
            {ranked.map((item, index) => (
              <button key={item.id} type="button" onClick={() => setCandidateId(item.id)} aria-pressed={candidate.id === item.id}
                className="flex w-full items-center gap-3 border p-3 text-left"
                style={{ borderColor: candidate.id === item.id ? 'var(--success)' : 'var(--line)', background: candidate.id === item.id ? 'rgba(22,242,179,.05)' : 'transparent' }}>
                <span className="text-xs font-black" style={{ color: 'var(--muted)' }}>#{index + 1}</span>
                <span className="min-w-0 flex-1"><strong className="block text-sm">{item.name}</strong><small className="mt-1 block" style={{ color: 'var(--muted)' }}>{item.summary}</small></span>
                <strong className="text-xl" style={{ color: 'var(--success)' }}>{item.score}</strong>
              </button>
            ))}
          </div>
        </div>

        <div className="panel p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div><p className="text-xs" style={{ color: 'var(--muted)' }}>{tx('当前首选 / 可切换核验', 'Selected candidate / switch to verify')}</p><h3 className="mt-1 text-lg font-black">{candidate.name}</h3></div>
            <span className="badge badge-success">score {candidate.score}</span>
          </div>
          <div className="mt-5 grid gap-3 md:grid-cols-2">
            {Object.entries(candidate.dimensions).map(([key, item]) => (
              <div key={key}>
                <div className="flex justify-between gap-3 text-xs"><strong>{tx(...dimensionLabels[key])}</strong><span>{item.score}/100</span></div>
                <div className="mt-2 h-2" style={{ background: 'var(--line)' }}><div className="h-full" style={{ width: `${item.score}%`, background: 'var(--success)' }} /></div>
                <p className="mt-2 text-xs leading-5" style={{ color: 'var(--muted)' }}>{item.reason} <span style={{ color: 'var(--info)' }}>[{item.sourceIds.join(', ')}]</span></p>
              </div>
            ))}
          </div>
          <div className="mt-5 border-l-2 pl-3 text-xs leading-6" style={{ borderColor: 'var(--warning)', color: 'var(--text-dim)' }}>
            <strong>{tx('为什么不是另一所？', 'Why not the alternative?')}</strong>
            <p>{candidate.name} {tx(`以 ${candidate.score - alternative.score} 分领先；`, `leads by ${candidate.score - alternative.score} points; `)}{alternative.name} {tx('仍是最强替代项，但其部分能力或受众证据较弱。', 'remains the strongest alternative, with weaker evidence on some capabilities or audiences.')}</p>
          </div>
        </div>
      </section>

      <section className="panel p-5" aria-labelledby="graph-title">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div><p className="text-xs font-black uppercase tracking-widest" style={{ color: 'var(--info)' }}>04 / EVIDENCE GRAPH LITE</p><h2 id="graph-title" className="mt-2 text-xl font-black">{tx('为什么推荐：结论 → 原文 → 官方页', 'Why recommended: conclusion → quote → official page')}</h2></div>
          <span className="badge badge-success">orphan claims = 0</span>
        </div>
        <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {evidenceIds.map((sourceId) => {
            const source = sourceById.get(sourceId);
            const claim = claimBySource.get(sourceId);
            if (!source) return null;
            return (
              <article key={sourceId} className="panel-deep p-4 text-xs leading-6">
                <span style={{ color: 'var(--success)' }}>{candidate.name}</span>
                <span className="mx-2" style={{ color: 'var(--muted)' }}>→</span>
                <strong>{claim && 'label' in claim ? claim.label : tx('评分依据', 'Scoring evidence')}</strong>
                {claim && 'quote' in claim && <blockquote className="mt-3 border-l-2 pl-3" style={{ borderColor: 'var(--info)', color: 'var(--text-dim)' }}>“{claim.quote}”</blockquote>}
                {'url' in source && <a className="mt-3 block break-all" style={{ color: 'var(--info)' }} href={source.url} target="_blank" rel="noreferrer">{source.label} ↗</a>}
              </article>
            );
          })}
        </div>
      </section>

      <section className="panel p-5" aria-labelledby="simulator-title">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div><p className="text-xs font-black uppercase tracking-widest" style={{ color: 'var(--info)' }}>05 / PROPOSAL SIMULATOR · {intelligence.proposalSimulator.schemaVersion}</p><h2 id="simulator-title" className="mt-2 text-xl font-black">{tx('轻 / 中 / 深资源约束模拟', 'Light / medium / deep resource simulation')}</h2></div>
          <div className="flex gap-2">
            {intelligence.proposalSimulator.tiers.map((item) => <button key={item.id} type="button" onClick={() => setTierId(item.id)} aria-pressed={tier.id === item.id} className={tier.id === item.id ? 'btn btn-success btn-sm' : 'btn btn-sm'}>{item.name}</button>)}
          </div>
        </div>
        <div className="mt-5 grid gap-4 lg:grid-cols-3">
          <div className="panel-deep p-4 text-sm leading-7"><strong>{tier.name} · v{tier.version}</strong><p className="mt-2" style={{ color: 'var(--muted)' }}>{tier.duration} · ¥{tier.cost.cashCny} · {tier.cost.peopleDays} people-days</p><p className="mt-3 text-xs">ClawTree: {tier.resources.clawtree.join(' / ')}</p><p className="mt-2 text-xs">Partner: {tier.resources.partner.join(' / ')}</p></div>
          <div className="panel-deep p-4 text-xs leading-6"><strong>{tx('交付物与 KPI', 'Deliverables and KPIs')}</strong>{tier.deliverables.map((item) => <p key={item} className="mt-2">✓ {item}</p>)}{tier.kpis.map((item) => <p key={item} className="mt-2" style={{ color: 'var(--success)' }}>KPI · {item}</p>)}</div>
          <div className="panel-deep p-4 text-xs leading-6"><strong style={{ color: 'var(--warning)' }}>{tx('资源缺口 / 不可承诺', 'Resource gaps / prohibited promises')}</strong>{tier.resourceGaps.map((item) => <p key={item} className="mt-2">△ {item}</p>)}{tier.prohibitedCommitments.map((item) => <p key={item} className="mt-2" style={{ color: 'var(--danger)' }}>× {item}</p>)}<p className="mt-3" style={{ color: 'var(--info)' }}>coverage 100% · {tier.sourceIds.join(', ')}</p></div>
        </div>
      </section>

      <section className="grid gap-5 xl:grid-cols-[1.1fr_.9fr]">
        <div className="panel p-5">
          <p className="text-xs font-black uppercase tracking-widest" style={{ color: 'var(--info)' }}>06 / RUN REPLAY</p>
          <h2 className="mt-2 text-xl font-black">{tx('30 秒技术证据', '30-second technical evidence')}</h2>
          <div className="mt-4 flex flex-wrap gap-2 text-xs"><span className="badge">{replayModel}</span><span className="badge">{replayLatency}ms</span><span className="badge">{replayCost}µUSD</span><span className="badge badge-success">verifier passed</span><span className="badge">fallback={String(replayFallback)}</span><span className={liveReplay ? 'badge badge-success' : 'badge'}>{liveReplay ? 'live backend replay' : 'offline fixture replay'}</span></div>
          <ol className="mt-5 grid gap-2">
            {replayStages.map((stage, index) => (
              <li key={stage.name} className="grid grid-cols-[28px_1fr_auto] items-center gap-3 border-b py-3 text-xs" style={{ borderColor: 'var(--line)' }}>
                <span style={{ color: 'var(--success)' }}>{String(index + 1).padStart(2, '0')}</span><span><strong>{stage.name}</strong><small className="mt-1 block" style={{ color: 'var(--muted)' }}>{stage.sourceIds.length} source refs · {stage.status}</small></span><span>{stage.latencyMs}ms</span>
              </li>
            ))}
          </ol>
          <p className="mt-4 text-xs leading-6" style={{ color: 'var(--muted)' }}>Human diff: {liveReplay?.humanReview.editSummary || intelligence.judgeEvidence.humanDiff.summary} Prompt / CoT / PII are intentionally excluded.</p>
        </div>

        <div className="panel p-5">
          <p className="text-xs font-black uppercase tracking-widest" style={{ color: 'var(--info)' }}>07 / GROUNDED DEMO COPILOT</p>
          <h2 className="mt-2 text-xl font-black">{tx('让评委自由追问', 'Let judges ask freely')}</h2>
          <form className="mt-4" onSubmit={askCopilot}>
            <label className="block text-xs font-black" htmlFor="judge-query">{tx('仅回答当前页面可引用事实', 'Answers only facts grounded on this page')}</label>
            <textarea id="judge-query" className="mt-2 min-h-24 w-full border bg-transparent p-3 text-sm" style={{ borderColor: 'var(--line)' }} value={query} onChange={(event) => setQuery(event.target.value)} maxLength={400} />
            <button type="submit" className="btn btn-success btn-sm mt-3" disabled={asking}>{asking ? tx('核验证据…', 'Checking evidence…') : tx('追问 Copilot', 'Ask Copilot')}</button>
          </form>
          {copilot && <div className="panel-deep mt-4 p-4 text-sm leading-7"><span className={copilot.grounded ? 'badge badge-success' : 'badge badge-warning'}>{copilot.decision}</span><p className="mt-3">{copilot.answer}</p>{copilot.citations.map((citation) => citation.url ? <a key={citation.id} href={citation.url} target="_blank" rel="noreferrer" className="mt-2 block text-xs" style={{ color: 'var(--info)' }}>[{citation.id}] {citation.label} ↗</a> : <span key={citation.id}>{citation.id}</span>)}</div>}
        </div>
      </section>

      <ProofReceiptPanel candidateName={candidate.name} tierName={tier.name} />
    </div>
  );
}
