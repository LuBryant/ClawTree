'use client';

import { useMemo, useState } from 'react';

import intelligence from '../../../data/champion-intelligence.json';
import { useLanguage } from '../../i18n/LanguageProvider';

type Candidate = (typeof intelligence.matches)[number];
type DimensionKey = keyof Candidate['dimensions'];
type PresetId = 'balanced' | 'evidence' | 'reach' | 'lean';

const presets: Record<PresetId, Record<DimensionKey, number>> = {
  balanced: {
    themeFit: 0.24,
    audienceFit: 0.18,
    capabilityFit: 0.18,
    timingFit: 0.12,
    evidenceQuality: 0.16,
    executionFeasibility: 0.12,
  },
  evidence: {
    themeFit: 0.18,
    audienceFit: 0.12,
    capabilityFit: 0.22,
    timingFit: 0.08,
    evidenceQuality: 0.30,
    executionFeasibility: 0.10,
  },
  reach: {
    themeFit: 0.20,
    audienceFit: 0.30,
    capabilityFit: 0.05,
    timingFit: 0.20,
    evidenceQuality: 0.10,
    executionFeasibility: 0.15,
  },
  lean: {
    themeFit: 0.18,
    audienceFit: 0.10,
    capabilityFit: 0.06,
    timingFit: 0.22,
    evidenceQuality: 0.14,
    executionFeasibility: 0.30,
  },
};

const presetLabels: Record<PresetId, [string, string]> = {
  balanced: ['平衡增长', 'Balanced growth'],
  evidence: ['证据优先', 'Evidence first'],
  reach: ['覆盖优先', 'Reach first'],
  lean: ['精益落地', 'Lean launch'],
};

const dimensionLabels: Record<DimensionKey, [string, string]> = {
  themeFit: ['主题', 'Theme'],
  audienceFit: ['受众', 'Audience'],
  capabilityFit: ['能力', 'Capability'],
  timingFit: ['时机', 'Timing'],
  evidenceQuality: ['证据', 'Evidence'],
  executionFeasibility: ['执行', 'Execution'],
};

function scoreCandidate(candidate: Candidate, weights: Record<DimensionKey, number>) {
  return Math.round((Object.keys(weights) as DimensionKey[])
    .reduce((sum, key) => sum + candidate.dimensions[key].score * weights[key], 0));
}

function tierBudgetCeiling(cashCny: string) {
  const numbers = cashCny.match(/\d+/g)?.map(Number) || [];
  return numbers.at(-1) || Number.POSITIVE_INFINITY;
}

export default function DecisionLab({
  selectedCandidateId,
  selectedTierId,
  onCandidateSelect,
  onTierSelect,
}: {
  selectedCandidateId: string;
  selectedTierId: string;
  onCandidateSelect: (candidateId: string) => void;
  onTierSelect: (tierId: string) => void;
}) {
  const { locale, tx } = useLanguage();
  const [preset, setPreset] = useState<PresetId>('balanced');
  const [budget, setBudget] = useState(20000);
  const [peopleDays, setPeopleDays] = useState(12);
  const weights = presets[preset];

  const ranking = useMemo(() => intelligence.matches
    .map((candidate) => ({ ...candidate, score: scoreCandidate(candidate, weights) }))
    .sort((a, b) => b.score - a.score), [weights]);

  const feasibleTiers = intelligence.proposalSimulator.tiers.filter((tier) => (
    tierBudgetCeiling(tier.cost.cashCny) <= budget && tier.cost.peopleDays <= peopleDays
  ));
  const recommendedTier = feasibleTiers.at(-1) || intelligence.proposalSimulator.tiers[0];
  const topDimensions = (Object.entries(weights) as Array<[DimensionKey, number]>)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 2);

  return (
    <section className="panel p-5" aria-labelledby="decision-lab-title">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-black uppercase tracking-widest" style={{ color: 'var(--info)' }}>02 / HUMAN-CONTROLLED DECISION LAB</p>
          <h2 id="decision-lab-title" className="mt-2 text-xl font-black">{tx('改变目标，现场重算推荐', 'Change the objective and rerank live')}</h2>
          <p className="mt-2 max-w-3xl text-xs leading-6" style={{ color: 'var(--muted)' }}>
            {tx('评委可以切换增长策略、预算与团队人天。排名和可交付方案由透明规则即时重算，AI 不替人隐藏权重。', 'Judges can change the growth objective, budget, and team capacity. Rankings and feasible tiers recalculate instantly with visible rules.')}
          </p>
        </div>
        <div className="flex flex-wrap gap-2 text-xs">
          <span className="badge badge-success">deterministic</span>
          <span className="badge">human override</span>
          <span className="badge badge-warning">no side effect</span>
        </div>
      </div>

      <div className="mt-5 grid gap-5 xl:grid-cols-[.78fr_1.22fr]">
        <div className="panel-deep p-4">
          <strong className="text-xs uppercase tracking-wider">{tx('合作目标', 'Partnership objective')}</strong>
          <div className="mt-3 grid grid-cols-2 gap-2">
            {(Object.keys(presets) as PresetId[]).map((id) => (
              <button key={id} type="button" onClick={() => setPreset(id)} aria-pressed={preset === id}
                className={preset === id ? 'btn btn-success btn-sm' : 'btn btn-sm'}>
                {tx(...presetLabels[id])}
              </button>
            ))}
          </div>

          <label className="mt-5 block text-xs font-black" htmlFor="decision-budget">
            {tx('预算上限', 'Budget ceiling')} · ¥{budget.toLocaleString(locale)}
          </label>
          <input id="decision-budget" className="mt-3 w-full accent-emerald-400" type="range" min="5000" max="80000" step="5000" value={budget} onChange={(event) => setBudget(Number(event.target.value))} />

          <label className="mt-5 block text-xs font-black" htmlFor="decision-days">
            {tx('团队可用人天', 'Available people-days')} · {peopleDays}
          </label>
          <input id="decision-days" className="mt-3 w-full accent-emerald-400" type="range" min="4" max="30" step="2" value={peopleDays} onChange={(event) => setPeopleDays(Number(event.target.value))} />

          <div className="mt-5 border-l-2 pl-3 text-xs leading-6" style={{ borderColor: 'var(--warning)', color: 'var(--text-dim)' }}>
            {tx('当前决策最看重', 'Top decision weights')}: {topDimensions.map(([key, value]) => `${tx(...dimensionLabels[key])} ${Math.round(value * 100)}%`).join(' · ')}
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-[1.15fr_.85fr]">
          <div className="panel-deep p-4">
            <div className="flex items-center justify-between gap-3">
              <strong className="text-xs uppercase tracking-wider">Live Top-K</strong>
              <span className="text-xs" style={{ color: 'var(--muted)' }}>{tx('点击同步到证据图', 'Click to sync evidence')}</span>
            </div>
            <div className="mt-3 grid gap-2">
              {ranking.map((candidate, index) => (
                <button key={candidate.id} type="button" onClick={() => onCandidateSelect(candidate.id)} aria-pressed={selectedCandidateId === candidate.id}
                  className="grid w-full grid-cols-[32px_1fr_auto] items-center gap-3 border p-3 text-left"
                  style={{ borderColor: selectedCandidateId === candidate.id ? 'var(--success)' : 'var(--line)', background: selectedCandidateId === candidate.id ? 'rgba(22,242,179,.05)' : 'transparent' }}>
                  <span className="font-mono text-xs" style={{ color: 'var(--muted)' }}>#{index + 1}</span>
                  <span className="min-w-0"><strong className="block text-xs">{candidate.name}</strong><small className="mt-1 block truncate" style={{ color: 'var(--muted)' }}>{candidate.summary}</small></span>
                  <strong className="text-xl" style={{ color: 'var(--success)' }}>{candidate.score}</strong>
                </button>
              ))}
            </div>
          </div>

          <div className="panel-deep p-4">
            <strong className="text-xs uppercase tracking-wider">{tx('资源约束结果', 'Capacity result')}</strong>
            <div className="mt-4">
              <span className="badge badge-success">{tx('推荐', 'Recommended')}</span>
              <h3 className="mt-3 text-lg font-black">{recommendedTier.name}</h3>
              <p className="mt-2 text-xs leading-6" style={{ color: 'var(--muted)' }}>{recommendedTier.duration} · ¥{recommendedTier.cost.cashCny} · {recommendedTier.cost.peopleDays} people-days</p>
            </div>
            <div className="mt-4 grid gap-2">
              {intelligence.proposalSimulator.tiers.map((tier) => {
                const feasible = feasibleTiers.some((item) => item.id === tier.id);
                return (
                  <button key={tier.id} type="button" disabled={!feasible} onClick={() => onTierSelect(tier.id)}
                    className="flex items-center justify-between border p-3 text-left text-xs"
                    style={{ borderColor: selectedTierId === tier.id ? 'var(--success)' : 'var(--line)', opacity: feasible ? 1 : 0.45 }}>
                    <span><strong className="block">{tier.name}</strong><small style={{ color: feasible ? 'var(--success)' : 'var(--danger)' }}>{feasible ? tx('容量内', 'Feasible') : tx('资源不足', 'Blocked')}</small></span>
                    <span>{tier.cost.peopleDays}d</span>
                  </button>
                );
              })}
            </div>
            <button type="button" className="btn btn-success btn-sm mt-4 w-full" onClick={() => onTierSelect(recommendedTier.id)}>
              {tx('采用推荐方案', 'Apply recommendation')}
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
