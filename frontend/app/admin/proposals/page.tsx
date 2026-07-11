'use client';

import { useEffect, useState } from 'react';

import { agentRuns, capabilityLibrary, proposalTargets } from '../../lib/public-data';
import { fetchAgentWorkflows, type AgentWorkflowResult } from '../../lib/api-client';
import { useLanguage } from '../../i18n/LanguageProvider';

export default function AdminProposalsPage() {
  const { tx } = useLanguage();
  const [liveWorkflows, setLiveWorkflows] = useState<AgentWorkflowResult[]>([]);
  useEffect(() => {
    fetchAgentWorkflows().then(setLiveWorkflows).catch(() => setLiveWorkflows([]));
  }, []);
  const tierLabels: Record<string, string> = {
    light: tx('轻量合作', 'Light partnership'),
    medium: tx('中度联动', 'Integrated collaboration'),
    deep: tx('深度合作', 'Deep partnership'),
  };
  return (
    <div className="flex flex-col gap-6">
      <section>
        <h1 className="font-normal leading-none tracking-tight" style={{ fontSize: 'clamp(1.6rem, 3.5vw, 2.6rem)' }}>
          {tx('合作提案', 'Partnership Proposals')}
        </h1>
        <p className="mt-2 text-sm" style={{ color: 'var(--muted)' }}>
          {tx('Proposal Agent 管理面：每个契合点必须引用活动事实或能力库事实；缺证据时进入待确认。', 'Proposal Agent workspace: every fit point must cite event or capability facts; insufficient evidence is held for review.')}
        </p>
      </section>

      <section className="grid gap-4 xl:grid-cols-3">
        {proposalTargets.map((target) => (
          <article key={target.id} className="panel p-5">
            <div className="flex flex-wrap items-center gap-2">
              <span className="badge badge-success">score {target.score}</span>
              <span className="badge">{target.city}</span>
              <span className={target.approvalStatus === 'ready_for_review' ? 'badge badge-warning' : 'badge'}>{target.approvalStatus}</span>
            </div>
            <h2 className="mt-4 text-xl font-black">{target.organization}</h2>
            <ul className="mt-4 grid gap-2 text-sm leading-6" style={{ color: 'var(--text-dim)' }}>
              {target.reasons.map((reason) => <li key={reason}>✓ {reason}</li>)}
            </ul>
            <div className="mt-5 grid gap-3">
              {Object.entries(target.tiers).map(([tier, value]) => (
                <div key={tier} className="panel-deep p-3">
                  <strong className="text-sm">{tierLabels[tier] || tier}</strong>
                  <p className="mt-2 text-xs leading-6" style={{ color: 'var(--muted)' }}>{value}</p>
                </div>
              ))}
            </div>
            <div className="mt-5 text-xs leading-6" style={{ color: 'var(--muted)' }}>
              <p>{tx('必须引用', 'Required citations')}: {target.mustCite.join(', ')}</p>
              <p>{tx('禁止承诺', 'Prohibited promises')}: {target.mustNotPromise.join(', ')}</p>
              <p>{tx('联系邮箱', 'Contact email')}: {target.maskedEmail} ({tx('默认遮罩', 'masked by default')})</p>
            </div>
            <button type="button" className="btn btn-success btn-sm mt-5">{tx('进入人工审批', 'Open human review')}</button>
          </article>
        ))}
      </section>

      <section className="panel p-5">
        <h2 className="text-xl font-black">{tx('真实 Agent 工作流', 'Live Agent workflows')}</h2>
        <p className="mt-2 text-sm" style={{ color: 'var(--muted)' }}>
          {tx('这里显示活动页触发的 Evidence → Match → Verifier → Proposal → Human Gate 持久化运行。', 'Persisted Evidence → Match → Verifier → Proposal → Human Gate runs triggered from the event browser.')}
        </p>
        <div className="mt-4 grid gap-3">
          {liveWorkflows.map((workflow) => (
            <div key={workflow.runId} className="panel-deep p-3 text-xs leading-6">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <strong>{workflow.runId}</strong>
                <span className="badge badge-warning">{workflow.status}</span>
              </div>
              <p className="mt-2" style={{ color: 'var(--muted)' }}>
                {workflow.checkpoints.map((item) => item.name).join(' → ')}
              </p>
              <p>AgentRuns: {workflow.agentRunIds.length} · Match: {workflow.matchId ?? '—'} · Proposal: {workflow.proposalId ?? '—'}</p>
              <p style={{ color: workflow.verifier?.passed ? 'var(--success)' : 'var(--danger)' }}>
                verifier: {workflow.verifier?.passed ? 'passed' : (workflow.verifier?.reasonCodes || []).join(', ') || 'pending'}
              </p>
              <p>externalSideEffect: false</p>
            </div>
          ))}
          {liveWorkflows.length === 0 && (
            <p className="text-sm" style={{ color: 'var(--muted)' }}>
              {tx('暂无真实工作流。请先在活动浏览器点击“可信匹配与提案”。', 'No live workflow yet. Run “Trusted match + proposal” from the event browser.')}
            </p>
          )}
        </div>
      </section>

      <section className="panel p-5">
        <h2 className="text-xl font-black">{tx('能力库引用', 'Capability citations')}</h2>
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          {capabilityLibrary.map((capability) => (
            <div key={capability.id} className="panel-deep p-3 text-sm">
              <strong>{capability.title}</strong>
              <p className="mt-2 text-xs leading-6" style={{ color: 'var(--muted)' }}>{capability.boundary}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="panel p-5">
        <h2 className="text-xl font-black">{tx('Agent 运行证据', 'Agent run evidence')}</h2>
        <p className="mt-2 text-sm" style={{ color: 'var(--muted)' }}>
          {tx('外部文本只进入不可信数据包；每类事实结论必须绑定允许的 source IDs，覆盖不足自动降级。', 'External text enters only an untrusted data envelope. Every factual conclusion must bind to allowed source IDs; insufficient coverage is automatically downgraded.')}
        </p>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {agentRuns.map((run) => (
            <div key={run.id} className="panel-deep p-3 text-xs leading-6" style={{ color: 'var(--muted)' }}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <strong className="text-sm" style={{ color: 'var(--text)' }}>{run.task}</strong>
                <span className={run.securityStatus === 'passed' ? 'badge badge-success' : 'badge badge-danger'}>
                  {run.securityStatus === 'passed' ? 'input safe' : 'injection quarantined'}
                </span>
              </div>
              <span className="mt-2 block">{run.provider} · {run.latency} · {run.cost}</span>
              <span className="block">boundary: {run.inputBoundary}</span>
              <span className="block" style={{ color: 'var(--success)' }}>coverage: {run.citationCoverage}</span>
              <div className="mt-2 grid gap-2">
                {run.claims.map((claim) => (
                  <div key={claim.id} className="border-l-2 pl-2" style={{ borderColor: 'rgba(120,166,255,.55)' }}>
                    <strong className="block" style={{ color: 'var(--text-dim)' }}>{claim.id}</strong>
                    <span className="block">{claim.text}</span>
                    <span className="block" style={{ color: 'var(--info)' }}>↳ {claim.sourceIds.join(', ')}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
