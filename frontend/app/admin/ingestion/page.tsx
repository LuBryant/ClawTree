'use client';

import { useEffect, useState, useCallback } from 'react';

interface PipelineStep {
  step: string;
  step_label: string;
  enabled: boolean;
  schedule_time: string;
  max_count: number;
  last_run: PipelineRun | null;
}

interface PipelineRun {
  id: number;
  step: string;
  step_label: string;
  status: string;
  status_label: string;
  collected: number;
  added: number;
  skipped: number;
  failed: number;
  duration_ms: number;
  error_message: string;
  started_at: string | null;
  finished_at: string | null;
  created_at: string;
}

const STEP_ICONS: Record<string, string> = {
  collect_events: '📡',
  fetch_tweets: '🐦',
  generate_emails: '📝',
  auto_approve: '📨',
};

const STEP_DESC: Record<string, string> = {
  collect_events: 'OpenClaw 自动采集各高校 AI/Web3 活动，提取标题、日期、联系方式并入库',
  fetch_tweets: '定时抓取大树财经推文，AI 筛选高校行/AI/世界杯主题，过滤敏感词后入库',
  generate_emails: '对活动浏览器中未外联的活动，批量 AI 生成合作邀请邮件，提交到外联审批台',
  auto_approve: '对外联审批台待审批草稿，自动审批并进行安全审核后发送邮件',
};

function formatDuration(ms: number) {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${Math.floor(ms / 60000)}m ${Math.round((ms % 60000) / 1000)}s`;
}

function formatDate(s: string | null) {
  if (!s) return '—';
  return new Date(s).toLocaleString('zh-CN', {
    month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit',
  });
}

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000/api';

function resolveUrl(path: string) {
  return API_BASE.startsWith('http') ? `${API_BASE}${path}` : `${window.location.origin}${path}`;
}

export default function AdminIngestionPage() {
  const [steps, setSteps] = useState<PipelineStep[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [running, setRunning] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState<Set<string>>(new Set());

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const res = await fetch(resolveUrl('/pipeline/'));
      if (!res.ok) throw new Error('API 不可用');
      const data = await res.json();
      setSteps(data);
      // 标记运行中的步骤
      const active = new Set<string>();
      for (const s of data) {
        if (s.last_run?.status === 'running') active.add(s.step);
      }
      setRunning(active);
    } catch {
      setError('无法连接后端 API');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // 自动轮询运行中步骤的状态
  useEffect(() => {
    if (running.size === 0) return;
    const timer = setInterval(load, 3000);
    return () => clearInterval(timer);
  }, [running.size, load]);

  const trigger = async (step: string) => {
    // 如果已在运行 → 停止
    if (running.has(step)) {
      try {
        await fetch(resolveUrl('/pipeline/stop/'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ step }),
        });
      } catch { /* ignore */ }
      setRunning((p) => { const n = new Set(p); n.delete(step); return n; });
      await load();
      return;
    }
    // 否则开始运行
    setRunning((p) => new Set(p).add(step));
    try {
      const res = await fetch(resolveUrl('/pipeline/trigger/'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ step }),
      });
      if (!res.ok) throw new Error('trigger failed');
      await load();
    } catch {
      alert('执行失败，请确认后端正在运行');
      setRunning((p) => { const n = new Set(p); n.delete(step); return n; });
    }
  };

  const updateConfig = async (step: string, patch: Record<string, unknown>) => {
    setSaving((p) => new Set(p).add(step));
    try {
      const current = steps.find((s) => s.step === step);
      await fetch(resolveUrl('/pipeline/configure/'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          step,
          enabled: patch.enabled ?? current?.enabled ?? false,
          schedule_time: patch.schedule_time ?? current?.schedule_time ?? '08:00',
          max_count: patch.max_count ?? current?.max_count ?? 10,
        }),
      });
      await load();
    } catch {
      alert('配置保存失败');
    } finally {
      setSaving((p) => { const n = new Set(p); n.delete(step); return n; });
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <section>
        <h1 className="font-normal leading-none tracking-tight" style={{ fontSize: 'clamp(1.6rem, 3.5vw, 2.6rem)' }}>
          采集运行
        </h1>
        <p className="mt-2 text-sm" style={{ color: 'var(--muted)' }}>
          OpenClaw 自动化流水线 — 4 步全链路：采集活动 → 推文筛选 → AI 邮件 → 审批发送
        </p>
      </section>

      {error && (
        <div className="text-center py-8" style={{ border: '1px solid rgba(255,61,87,0.42)', background: 'rgba(255,61,87,0.08)', color: 'var(--danger)' }}>
          <p className="text-sm font-bold">{error}</p>
        </div>
      )}

      {loading && <div className="flex justify-center py-20"><div className="spinner" /></div>}

      {!loading && !error && (
        <div className="flex flex-col gap-4">
          {steps.map((s) => {
            const isRunning = running.has(s.step);
            const isSaving = saving.has(s.step);
            const run = s.last_run;
            const statusColor = run?.status === 'succeeded' ? 'var(--success)'
              : run?.status === 'failed' ? 'var(--danger)'
              : run?.status === 'running' ? 'var(--warning)'
              : 'var(--muted)';

            // --- Main pipeline card ---
            return (
              <article key={s.step} className="panel" style={{ padding: '20px' }}>
                {/* Header row */}
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <span style={{ fontSize: '1.6rem' }}>{STEP_ICONS[s.step]}</span>
                    <div>
                      <h3 className="text-base font-black uppercase tracking-wider">{s.step_label}</h3>
                      <p className="text-xs mt-0.5" style={{ color: 'var(--muted)' }}>{STEP_DESC[s.step]}</p>
                    </div>
                  </div>
                  {/* 控制区 */}
                  <div className="flex items-center gap-3">
                    {/* 数量配置 */}
                    <div className="flex items-center gap-1">
                      <span className="text-xs" style={{ color: 'var(--muted)' }}>上限</span>
                      <input type="number" min={1} max={999} value={s.max_count ?? 10}
                        disabled={isSaving || isRunning}
                        onChange={(e) => updateConfig(s.step, { max_count: parseInt(e.target.value) || 10 })}
                        className="input-field" style={{ width: 58, padding: '4px 6px', fontSize: '0.78rem', textAlign: 'center' }} />
                    </div>
                    {/* 启动/停止 */}
                    <button
                      className={`btn btn-sm ${isRunning ? 'btn-danger' : 'btn-success'}`}
                      onClick={() => trigger(s.step)}>
                      {isRunning ? '⏹ 停止' : '▶ 启动'}
                    </button>
                    {/* 定时开关 */}
                    <label className="flex items-center gap-2 text-xs font-bold cursor-pointer select-none"
                      style={{ color: s.enabled ? 'var(--success)' : 'var(--muted)' }}>
                      <input type="checkbox" checked={s.enabled} disabled={isSaving}
                        onChange={(e) => updateConfig(s.step, { enabled: e.target.checked })} />
                      定时
                    </label>
                    {s.enabled && (
                      <input type="time" value={s.schedule_time} disabled={isSaving}
                        onChange={(e) => updateConfig(s.step, { schedule_time: e.target.value })}
                        className="input-field" style={{ width: 82, padding: '4px 6px', fontSize: '0.78rem' }} />
                    )}
                  </div>
                </div>

                {/* Stats row */}
                {run && (
                  <div className="mt-4 pt-4" style={{ borderTop: '1px solid var(--line)' }}>
                    <div className="flex flex-wrap items-center gap-4 text-xs">
                      <span className="badge" style={{ borderColor: statusColor, background: `${statusColor}22`, color: statusColor }}>
                        {run.status_label}
                      </span>
                      <span style={{ color: 'var(--muted)' }}>
                        {formatDate(run.started_at)} · {formatDuration(run.duration_ms)}
                      </span>
                      {run.collected > 0 && <span style={{ color: 'var(--text-dim)' }}>📊 {run.collected}</span>}
                      {run.added > 0 && <span style={{ color: 'var(--success)' }}>✅ +{run.added}</span>}
                      {run.skipped > 0 && <span style={{ color: 'var(--warning)' }}>⏭ {run.skipped}</span>}
                      {run.failed > 0 && run.step === 'fetch_tweets' && <span style={{ color: 'var(--info)' }}>✨ 润色 {run.failed}</span>}
                      {run.failed > 0 && run.step !== 'fetch_tweets' && <span style={{ color: 'var(--danger)' }}>❌ {run.failed}</span>}
                    </div>
                    {/* 进度条 */}
                    {run.status === 'running' && s.max_count > 0 && (
                      <div className="mt-2" style={{ height: 4, background: 'var(--line)', borderRadius: 2 }}>
                        <div style={{
                          height: 4, borderRadius: 2, background: 'var(--success)',
                          width: `${Math.min(100, (run.added / s.max_count) * 100)}%`,
                          transition: 'width 0.5s',
                        }} />
                      </div>
                    )}
                    {run.error_message && (
                      <p className="mt-2 text-xs font-mono" style={{ color: 'var(--danger)' }}>{run.error_message}</p>
                    )}
                  </div>
                )}

                {/* 无运行记录 */}
                {!run && (
                  <div className="mt-4 pt-4" style={{ borderTop: '1px solid var(--line)' }}>
                    <span className="text-xs" style={{ color: 'var(--muted)' }}>暂无运行记录</span>
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
