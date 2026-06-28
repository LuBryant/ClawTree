'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { fetchEventStats, type EventStats } from '../lib/api-client';

export default function AdminDashboard() {
  const [stats, setStats] = useState<EventStats | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    fetchEventStats().then(setStats).catch(() => setError(true));
  }, []);

  return (
    <div className="flex flex-col gap-8">
      <section>
        <h1 className="font-normal leading-none tracking-tight"
          style={{ fontSize: 'clamp(1.8rem, 4vw, 3rem)' }}>
          Dashboard
        </h1>
        <p className="mt-1 text-sm" style={{ color: 'var(--muted)' }}>
          大树财经团队 · 高校 AI/Web3 活动运营控制台
        </p>
      </section>

      {/* 指标 */}
      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          { label: '活动总量', v: stats?.total, sub: '已采集入库', c: 'var(--success)' },
          { label: 'AI 活动', v: stats?.by_category?.AI, sub: '人工智能相关', c: 'var(--info)' },
          { label: 'Web3 活动', v: stats?.by_category?.Web3, sub: '区块链相关', c: 'var(--warning)' },
          { label: '待外联', v: stats?.uncontacted, sub: `${stats?.contacted ?? 0} 已联系`, c: 'var(--danger)' },
        ].map((c) => (
          <div key={c.label} className="panel" style={{ padding: '18px' }}>
            <p className="text-xs font-black uppercase tracking-wider" style={{ color: 'var(--muted)' }}>{c.label}</p>
            <p className="mt-2" style={{ fontSize: '2rem', fontWeight: 950, lineHeight: 1, color: c.c }}>
              {stats ? c.v : '—'}
            </p>
            <p className="mt-1 text-xs" style={{ color: 'var(--muted)' }}>{c.sub}</p>
          </div>
        ))}
      </section>

      {/* 快捷操作 */}
      <section>
        <h2 className="text-sm font-black uppercase tracking-widest mb-4">⚡ 快捷操作</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Link href="/admin/events" className="panel event-card" style={{ padding: '20px' }}>
            <p className="text-2xl mb-3">📅</p>
            <h3 className="text-base font-black uppercase tracking-wider">活动浏览器</h3>
            <p className="mt-1 text-xs leading-relaxed" style={{ color: 'var(--muted)' }}>浏览、筛选所有已采集活动及联系方式</p>
          </Link>
          {[
            { icon: '📨', title: '外联管道', desc: '即将上线 — 智能邮件 + 批量发送' },
            { icon: '📈', title: '趋势洞察', desc: '即将上线 — 趋势分析 + 报告' },
          ].map((x) => (
            <div key={x.title} className="panel event-card" style={{ padding: '20px', opacity: 0.45 }}>
              <p className="text-2xl mb-3">{x.icon}</p>
              <h3 className="text-base font-black uppercase tracking-wider" style={{ color: 'var(--text-dim)' }}>{x.title}</h3>
              <p className="mt-1 text-xs leading-relaxed" style={{ color: 'var(--muted)' }}>{x.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* 系统状态 */}
      <section className="panel" style={{ padding: '20px' }}>
        <h3 className="text-sm font-black uppercase tracking-wider mb-3" style={{ color: 'var(--text-dim)' }}>🔧 系统状态</h3>
        {[
          { ok: !error, text: error ? '后端未连接 — 运行 python manage.py runserver' : '后端 API 正常' },
          { ok: true, text: '事件采集 — python manage.py fetch_events' },
        ].map((x, i) => (
          <div key={i} className="flex items-center gap-3 mt-2 text-sm" style={{ color: 'var(--text-dim)' }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: x.ok ? 'var(--success)' : 'var(--danger)', display: 'inline-block' }} />
            {x.text}
          </div>
        ))}
        <div className="flex items-center gap-3 mt-2 text-sm">
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--success)', display: 'inline-block' }} />
          <a href="http://127.0.0.1:8000/admin/" target="_blank" rel="noopener noreferrer"
            style={{ color: 'var(--text-dim)' }} className="hover:underline">
            Django Admin → 直接管理数据库
          </a>
        </div>
      </section>
    </div>
  );
}
