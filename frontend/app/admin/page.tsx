'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { fetchEventStats, type EventStats } from '../lib/api-client';
import { useLanguage } from '../i18n/LanguageProvider';

export default function AdminDashboard() {
  const [stats, setStats] = useState<EventStats | null>(null);
  const [error, setError] = useState(false);
  const [htxPrice, setHtxPrice] = useState<string | null>(null);
  const { tx } = useLanguage();

  useEffect(() => {
    fetchEventStats().then(setStats).catch(() => setError(true));
    // HTX 行情 — 体现 HTX 生态集成
    fetch('https://api.huobi.pro/market/detail/merged?symbol=htxusdt')
      .then((r) => r.json())
      .then((d) => {
        if (d.status === 'ok' && d.tick) {
          const price = Number(d.tick.close);
          setHtxPrice(price < 0.0001 ? price.toExponential(2) : '$' + price.toFixed(6));
        }
      })
      .catch(() => {});
  }, []);

  return (
    <div className="flex flex-col gap-8">
      <section>
        <h1 className="font-normal leading-none tracking-tight"
          style={{ fontSize: 'clamp(1.8rem, 4vw, 3rem)' }}>
          Dashboard
        </h1>
        <p className="mt-1 text-sm" style={{ color: 'var(--muted)' }}>
          {tx('大树财经团队 · 高校 AI/Web3 活动运营控制台', 'TreeFinance · Campus AI/Web3 Operations Console')}
        </p>
      </section>

      {/* 指标 */}
      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {[
          { label: tx('活动总量', 'Total events'), v: stats?.total, sub: tx('已采集入库', 'collected'), c: 'var(--success)' },
          { label: tx('AI 活动', 'AI events'), v: stats?.by_category?.AI, sub: tx('人工智能相关', 'AI-related'), c: 'var(--info)' },
          { label: tx('Web3 活动', 'Web3 events'), v: stats?.by_category?.Web3, sub: tx('区块链相关', 'blockchain-related'), c: 'var(--warning)' },
          { label: tx('待外联', 'Awaiting outreach'), v: stats?.uncontacted, sub: `${stats?.contacted ?? 0} ${tx('已联系', 'contacted')}`, c: 'var(--danger)' },
          { label: '$HTX', v: htxPrice, sub: tx('HTX 生态 · TRON Nile gas', 'HTX ecosystem · TRON Nile gas'), c: 'var(--success)' },
        ].map((c) => (
          <div key={c.label} className="panel" style={{ padding: '18px' }}>
            <p className="text-xs font-black uppercase tracking-wider" style={{ color: 'var(--muted)' }}>{c.label}</p>
            <p className="mt-2" style={{ fontSize: '2rem', fontWeight: 950, lineHeight: 1, color: c.c }}>
              {c.v ? c.v : '—'}
            </p>
            <p className="mt-1 text-xs" style={{ color: 'var(--muted)' }}>{c.sub}</p>
          </div>
        ))}
      </section>

      {/* 快捷操作 */}
      <section>
        <h2 className="text-sm font-black uppercase tracking-widest mb-4">⚡ {tx('快捷操作', 'Quick actions')}</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Link href="/admin/events" className="panel event-card" style={{ padding: '20px' }}>
            <p className="text-2xl mb-3">📅</p>
            <h3 className="text-base font-black uppercase tracking-wider">{tx('活动浏览器', 'Event browser')}</h3>
            <p className="mt-1 text-xs leading-relaxed" style={{ color: 'var(--muted)' }}>{tx('浏览、筛选所有已采集活动及联系方式', 'Browse and filter collected events and contacts')}</p>
          </Link>
          <Link href="/admin/reviews" className="panel event-card" style={{ padding: '20px' }}>
            <p className="text-2xl mb-3">📸</p>
            <h3 className="text-base font-black uppercase tracking-wider">{tx('活动回顾', 'Event recaps')}</h3>
            <p className="mt-1 text-xs leading-relaxed" style={{ color: 'var(--muted)' }}>{tx('AI 整理的往期活动回顾与精彩瞬间', 'AI-organized event recaps and highlights')}</p>
          </Link>
          {[
            { icon: '📨', title: tx('外联管道', 'Outreach pipeline'), desc: tx('即将上线 — 智能邮件 + 批量发送', 'Coming soon — smart email + batch delivery') },
            { icon: '📈', title: tx('趋势洞察', 'Trend intelligence'), desc: tx('即将上线 — 趋势分析 + 报告', 'Coming soon — trend analysis + reports') },
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
