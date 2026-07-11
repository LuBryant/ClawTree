'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';

import demo from '../../../data/demo.json';
import intelligence from '../../../data/champion-intelligence.json';
import observability from '../../../data/agent-observability.json';
import { useLanguage } from '../../i18n/LanguageProvider';

const STEP_SECONDS = 18;
const TOTAL_SECONDS = STEP_SECONDS * 5;

const steps = [
  ['公开信号', 'PUBLIC SIGNALS'],
  ['证据 / Agent', 'EVIDENCE / AGENT'],
  ['学校排名', 'CAMPUS RANKING'],
  ['人工闸门', 'HUMAN GATE'],
  ['影响凭证', 'PROOF'],
] as const;

const weightedScore = (match: (typeof intelligence.matches)[number]) => {
  const weights: Record<string, number> = {
    themeFit: 0.24, audienceFit: 0.16, capabilityFit: 0.18,
    timingFit: 0.12, evidenceQuality: 0.18, executionFeasibility: 0.12,
  };
  return Math.round(Object.entries(match.dimensions).reduce(
    (sum, [key, value]) => sum + value.score * (weights[key] ?? 0), 0,
  ));
};

export default function MissionControlPage() {
  const { language, tx, toggleLanguage } = useLanguage();
  const [elapsed, setElapsed] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [gateDecision, setGateDecision] = useState<'pending' | 'approved' | 'returned'>('pending');
  const active = Math.min(4, Math.floor(elapsed / STEP_SECONDS));
  const ranked = useMemo(() => intelligence.matches
    .map((item) => ({ ...item, total: weightedScore(item) }))
    .sort((a, b) => b.total - a.total), []);
  const sourceNodes = intelligence.graph.nodes.filter((node) => node.type === 'source');
  const proofHash = '0x7d41b8f9c6a2…91e3c04a';

  useEffect(() => {
    if (!playing) return;
    const timer = window.setInterval(() => {
      setElapsed((value) => {
        if (value >= TOTAL_SECONDS) {
          setPlaying(false);
          return TOTAL_SECONDS;
        }
        return value + 1;
      });
    }, 1000);
    return () => window.clearInterval(timer);
  }, [playing]);

  const replay = useCallback(() => {
    setElapsed(0);
    setPlaying(true);
    setGateDecision('pending');
  }, []);

  const jump = (index: number) => {
    setElapsed(index * STEP_SECONDS);
    setPlaying(false);
  };

  return (
    <main className="min-h-screen px-4 py-5 text-white sm:px-7 lg:px-10" style={{ background: 'radial-gradient(circle at 70% 10%, #123d32 0, #071713 31%, #030807 72%)' }}>
      <div className="mx-auto max-w-[1500px]">
        <header className="flex flex-wrap items-start justify-between gap-4 border-b border-emerald-300/20 pb-5">
          <div>
            <div className="mb-2 flex flex-wrap items-center gap-2 text-[10px] font-black tracking-[.2em]">
              <span className="rounded-full border border-amber-300/50 bg-amber-300/10 px-3 py-1 text-amber-200">FIXTURE</span>
              <span className="rounded-full border border-cyan-300/40 bg-cyan-300/10 px-3 py-1 text-cyan-200">MOCK OUTREACH</span>
              <span className="rounded-full border border-emerald-300/40 bg-emerald-300/10 px-3 py-1 text-emerald-200">externalSideEffect=false</span>
            </div>
            <h1 className="text-3xl font-black tracking-[-.04em] sm:text-5xl">CLAWTREE <span className="text-emerald-300">MISSION CONTROL</span></h1>
            <p className="mt-2 max-w-3xl text-sm text-white/55">{tx('90 秒：把分散公开信号变成有证据、有人审、可验证的高校合作。', '90 seconds: public signals become sourced, human-approved, verifiable campus partnerships.')}</p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={toggleLanguage} className="rounded-lg border border-white/20 px-3 py-2 text-xs font-bold hover:bg-white/10">{language === 'zh' ? 'EN' : '中文'}</button>
            <button onClick={() => setPlaying((value) => !value)} className="rounded-lg border border-emerald-300/40 bg-emerald-300/10 px-4 py-2 text-xs font-black text-emerald-200">{playing ? tx('暂停', 'PAUSE') : tx('继续', 'PLAY')}</button>
            <button onClick={replay} className="rounded-lg bg-emerald-300 px-4 py-2 text-xs font-black text-black">{tx('重播', 'REPLAY')}</button>
          </div>
        </header>

        <nav className="my-5 grid grid-cols-5 gap-1" aria-label={tx('演示步骤', 'Demo steps')}>
          {steps.map(([zh, en], index) => {
            const done = index < active || elapsed === TOTAL_SECONDS;
            const current = index === active && elapsed < TOTAL_SECONDS;
            return <button key={en} onClick={() => jump(index)} className="relative overflow-hidden rounded-lg border px-2 py-3 text-left transition" style={{ borderColor: current ? '#6ee7b7' : done ? '#2f8068' : '#25342f', background: current ? 'rgba(52,211,153,.14)' : 'rgba(255,255,255,.025)' }}>
              <span className="block text-[9px] font-black text-white/35">0{index + 1}</span>
              <strong className="block truncate text-[10px] sm:text-xs" style={{ color: current || done ? '#a7f3d0' : '#73807b' }}>{tx(zh, en)}</strong>
              {current && <span className="absolute bottom-0 left-0 h-[2px] bg-emerald-300" style={{ width: `${((elapsed % STEP_SECONDS) / STEP_SECONDS) * 100}%` }} />}
            </button>;
          })}
        </nav>

        <section className="grid min-h-[530px] gap-4 lg:grid-cols-[1.45fr_.75fr]">
          <div className="rounded-2xl border border-white/10 bg-black/25 p-5 shadow-2xl backdrop-blur sm:p-7">
            {active === 0 && <Signals tx={tx} />}
            {active === 1 && <Agents tx={tx} sourceCount={sourceNodes.length} />}
            {active === 2 && <Ranking tx={tx} ranked={ranked} />}
            {active === 3 && <Gate tx={tx} top={ranked[0]} decision={gateDecision}
              onApprove={() => { setGateDecision('approved'); setElapsed(STEP_SECONDS * 4); setPlaying(false); }}
              onReturn={() => { setGateDecision('returned'); setPlaying(false); }} />}
            {active === 4 && <Proof tx={tx} hash={proofHash} approved={gateDecision === 'approved'} onReturn={() => jump(3)} />}
          </div>

          <aside className="flex flex-col gap-4">
            <div className="rounded-2xl border border-emerald-300/20 bg-emerald-300/[.06] p-5">
              <div className="flex items-end justify-between"><span className="text-[10px] font-black tracking-[.18em] text-white/40">MISSION CLOCK</span><strong className="font-mono text-3xl text-emerald-200">{String(Math.floor(elapsed / 60)).padStart(2, '0')}:{String(elapsed % 60).padStart(2, '0')}</strong></div>
              <div className="mt-4 h-1.5 overflow-hidden rounded bg-white/10"><div className="h-full bg-emerald-300 transition-all" style={{ width: `${elapsed / TOTAL_SECONDS * 100}%` }} /></div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Metric value={demo.funnel.signalsVerified} label={tx('已核验信号', 'verified signals')} />
              <Metric value={demo.funnel.targetsShortlisted} label={tx('候选高校', 'campus targets')} />
              <Metric value={`${Math.round(observability.tasks[0].successRate * 100)}%`} label={tx('分类成功率', 'classify success')} />
              <Metric value={`$${(observability.budget.spentMicrousd / 1_000_000).toFixed(3)}`} label={tx('本次 Agent 成本', 'agent cost')} />
            </div>
            <div className="flex-1 rounded-2xl border border-white/10 bg-white/[.035] p-5 text-xs leading-6 text-white/55">
              <strong className="mb-2 block text-white">{tx('可信边界', 'TRUST BOUNDARY')}</strong>
              <p>✓ {tx('每个结论绑定 sourceIds', 'Every claim binds to sourceIds')}</p>
              <p>✓ {tx('结构化 Schema 校验', 'Structured schema validation')}</p>
              <p>✓ {tx('真实动作必须人工批准', 'Human approval before side effects')}</p>
              <p>✓ {tx('联系人和正文永不上链', 'Contacts and message body stay offchain')}</p>
              <div className="mt-4 border-t border-white/10 pt-3 font-mono text-[10px] text-amber-200">DATA MODE: {intelligence.meta.dataMode}<br />PROVIDER: deterministic fixture<br />SIDE EFFECT: FALSE</div>
            </div>
          </aside>
        </section>
      </div>
    </main>
  );
}

type Tx = (zh: string, en: string) => string;

function Metric({ value, label }: { value: string | number; label: string }) {
  return <div className="rounded-xl border border-white/10 bg-white/[.035] p-4"><strong className="block text-2xl text-emerald-200">{value}</strong><span className="text-[10px] uppercase tracking-wider text-white/40">{label}</span></div>;
}

function Signals({ tx }: { tx: Tx }) {
  return <div><Kicker text="01 / SIGNAL RADAR" /><h2 className="mt-2 text-3xl font-black">{tx('公开事实进入雷达', 'PUBLIC FACTS ENTER THE RADAR')}</h2><p className="mt-2 text-sm text-white/45">{tx('不是抓取后直接相信：来源、时间、验证状态同时进入系统。', 'Sources are not trusted on arrival: provenance, time and verification travel together.')}</p><div className="mt-7 grid gap-3 sm:grid-cols-2">{demo.signals.map((signal, i) => <article key={signal.id} className="rounded-xl border border-white/10 bg-white/[.035] p-4" style={{ animation: `missionIn .45s ease ${i * .12}s both` }}><div className="flex justify-between text-[9px] font-black tracking-widest"><span className="text-emerald-300">VERIFIED · {Math.round(signal.confidence * 100)}%</span><span className="text-white/30">{signal.platform.toUpperCase()}</span></div><h3 className="mt-3 text-sm font-bold leading-5">{signal.title}</h3><div className="mt-3 flex flex-wrap gap-1">{signal.tags.slice(0, 3).map((tag) => <span key={tag} className="rounded bg-white/5 px-2 py-1 text-[9px] text-white/45">{tag}</span>)}</div></article>)}</div><Animation /></div>;
}

function Agents({ tx, sourceCount }: { tx: Tx; sourceCount: number }) {
  return <div><Kicker text="02 / AGENT FLIGHT RECORDER" /><h2 className="mt-2 text-3xl font-black">{tx('Agent 给判断，也交出证据', 'THE AGENT RETURNS EVIDENCE, NOT JUST AN ANSWER')}</h2><div className="mt-7 space-y-3">{observability.tasks.map((task, index) => <div key={task.task} className="grid items-center gap-3 rounded-xl border border-emerald-300/15 bg-emerald-300/[.045] p-4 sm:grid-cols-[42px_1fr_auto]" style={{ animation: `missionIn .45s ease ${index * .18}s both` }}><span className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-300 font-black text-black">✓</span><div><strong className="uppercase">{task.task}</strong><p className="text-xs text-white/40">{task.connector} · schema valid · citations attached</p></div><div className="text-right font-mono text-xs"><b className="text-emerald-200">{Math.round(task.successRate * 100)}%</b><br /><span className="text-white/35">p95 {task.p95LatencyMs}ms</span></div></div>)}</div><div className="mt-6 grid grid-cols-3 gap-2 text-center"><Metric value={sourceCount} label={tx('证据节点', 'source nodes')} /><Metric value="100%" label={tx('引用覆盖', 'citation coverage')} /><Metric value="VALID" label="JSON SCHEMA" /></div><Animation /></div>;
}

function Ranking({ tx, ranked }: { tx: Tx; ranked: Array<(typeof intelligence.matches)[number] & { total: number }> }) {
  return <div><Kicker text="03 / EXPLAINABLE MATCHING" /><h2 className="mt-2 text-3xl font-black">{tx('学校不是被“推荐”，而是被解释', 'CAMPUSES ARE EXPLAINED, NOT MERELY RECOMMENDED')}</h2><div className="mt-6 space-y-3">{ranked.map((item, index) => <div key={item.id} className="grid items-center gap-3 rounded-xl border border-white/10 bg-white/[.035] p-4 sm:grid-cols-[34px_1fr_100px_48px]" style={{ animation: `missionIn .4s ease ${index * .1}s both` }}><span className="text-lg font-black text-white/25">#{index + 1}</span><div><strong className="text-sm">{item.name}</strong><p className="truncate text-[10px] text-white/40">{item.summary}</p></div><div className="h-2 overflow-hidden rounded bg-white/10"><div className="h-full bg-emerald-300" style={{ width: `${item.total}%` }} /></div><b className="text-right text-xl text-emerald-200">{item.total}</b></div>)}</div><p className="mt-5 text-xs text-white/40">{tx('六维加权：主题、受众、能力、时机、证据质量、执行可行性。', 'Six weighted dimensions: theme, audience, capability, timing, evidence and feasibility.')}</p><Animation /></div>;
}

function Gate({ tx, top, decision, onApprove, onReturn }: { tx: Tx; top: (typeof intelligence.matches)[number] & { total: number }; decision: 'pending' | 'approved' | 'returned'; onApprove: () => void; onReturn: () => void }) {
  return <div><Kicker text="04 / HUMAN-IN-THE-LOOP" /><h2 className="mt-2 text-3xl font-black">{tx('AI 到此为止。人类决定是否行动。', 'AI STOPS HERE. A HUMAN DECIDES WHAT HAPPENS NEXT.')}</h2><div className="mt-8 rounded-2xl border border-amber-300/35 bg-amber-300/[.07] p-6"><div className="flex flex-wrap items-start justify-between gap-4"><div><span className="text-[10px] font-black tracking-widest text-amber-200">{decision === 'pending' ? 'AWAITING APPROVAL' : decision === 'approved' ? 'HUMAN APPROVED · MOCK ONLY' : 'RETURNED FOR EDIT'}</span><h3 className="mt-2 text-xl font-black">{top.name}</h3><p className="mt-1 text-sm text-white/45">{intelligence.opportunity.hypothesis}</p></div><strong className="text-4xl text-emerald-200">{top.total}</strong></div><div className="my-5 border-y border-white/10 py-4 text-sm text-white/65">{tx('允许：生成一封独立草稿；禁止：自动发送、承诺嘉宾/奖金/投资、写入个人信息。', 'Allowed: create one isolated draft. Blocked: auto-send, promise speakers/prizes/investment, or expose personal data.')}</div><div className="flex flex-wrap gap-3"><button type="button" onClick={onApprove} disabled={decision === 'approved'} className="rounded-lg bg-emerald-300 px-6 py-3 text-xs font-black text-black">✓ {decision === 'approved' ? tx('已人工批准', 'HUMAN APPROVED') : tx('批准模拟外联', 'APPROVE MOCK OUTREACH')}</button><button type="button" onClick={onReturn} className="rounded-lg border border-white/20 px-6 py-3 text-xs font-black text-white/55">{tx('退回修改', 'RETURN FOR EDIT')}</button></div>{decision !== 'pending' && <p className="mt-4 text-xs text-white/55">AUDIT · {decision} · actor=demo-operator · externalSideEffect=false</p>}</div><div className="mt-5 rounded-xl border border-emerald-300/20 p-4 font-mono text-xs text-emerald-200">externalSideEffect: false<br />recipient: demo-*.example.invalid<br />approvalRequired: true</div><Animation /></div>;
}

function Proof({ tx, hash, approved, onReturn }: { tx: Tx; hash: string; approved: boolean; onReturn: () => void }) {
  if (!approved) return <div><Kicker text="05 / PRIVACY-SAFE PROOF" /><h2 className="mt-2 text-3xl font-black">{tx('没有人工批准，就没有执行凭证', 'NO HUMAN APPROVAL, NO EXECUTION PROOF')}</h2><div className="mt-8 rounded-2xl border border-amber-300/35 bg-amber-300/[.07] p-8 text-center"><div className="text-5xl">⏸</div><strong className="mt-5 block text-xl">HUMAN GATE BLOCKED</strong><p className="mt-3 text-sm text-white/45">{tx('系统不会把“AI 推荐”伪装成“已执行”。请返回上一步完成明确的人类决定。', 'The system never disguises an AI recommendation as an executed action. Return to the human gate for an explicit decision.')}</p><button type="button" onClick={onReturn} className="mt-6 rounded-lg bg-emerald-300 px-6 py-3 text-xs font-black text-black">← {tx('返回人工闸门', 'RETURN TO HUMAN GATE')}</button></div><Animation /></div>;
  return <div><Kicker text="05 / PRIVACY-SAFE PROOF" /><h2 className="mt-2 text-3xl font-black">{tx('执行结果可验证，隐私不公开', 'VERIFY EXECUTION WITHOUT PUBLISHING PRIVATE DATA')}</h2><div className="mt-8 overflow-hidden rounded-2xl border border-emerald-300/40 bg-gradient-to-br from-emerald-300/15 to-cyan-300/[.04] p-7"><div className="flex flex-wrap justify-between gap-4"><div><span className="text-[10px] font-black tracking-[.2em] text-emerald-200">PROOF ANCHORED · MOCK NILE</span><h3 className="mt-3 text-2xl font-black">Impact Passport #CMP-2026-GZ</h3></div><div className="flex h-14 w-14 items-center justify-center rounded-full border border-emerald-300/50 text-2xl">✓</div></div><code className="mt-7 block rounded-lg bg-black/35 p-4 text-sm text-emerald-200">{hash}</code><div className="mt-6 grid gap-3 sm:grid-cols-2"><div className="rounded-lg bg-white/5 p-4 text-xs leading-6"><strong>{tx('凭证包含', 'PROOF ALLOWLIST')}</strong><p className="text-white/45">campaignId · signalIds · approvalStatus</p></div><div className="rounded-lg bg-white/5 p-4 text-xs leading-6"><strong>{tx('永不上链', 'NEVER ONCHAIN')}</strong><p className="text-white/45">contacts · message body · replies · prompts · credentials</p></div></div></div><div className="mt-5 flex items-center gap-3 text-sm text-white/50"><span className="h-2 w-2 animate-pulse rounded-full bg-emerald-300" />{tx('同一规范化输入可重新计算并验证哈希。', 'The same canonical payload deterministically reproduces this hash.')}</div><Animation /></div>;
}

function Kicker({ text }: { text: string }) { return <span className="text-[10px] font-black tracking-[.22em] text-emerald-300">{text}</span>; }
function Animation() { return <style jsx global>{`@keyframes missionIn{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:translateY(0)}}`}</style>; }
