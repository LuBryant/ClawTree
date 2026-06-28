'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { fetchEventStats, type EventStats } from '../lib/api-client';

export default function AdminDashboard() {
  const [stats, setStats] = useState<EventStats | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    fetchEventStats()
      .then(setStats)
      .catch(() => setError(true));
  }, []);

  return (
    <div className="flex flex-col gap-8">
      {/* 页头 */}
      <section>
        <h1 className="text-3xl font-bold tracking-tight">管理端 Dashboard</h1>
        <p className="mt-1 text-sm text-zinc-500">
          大树财经团队 · 高校 AI/Web3 活动运营控制台
        </p>
      </section>

      {/* 统计卡片 */}
      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          {
            label: '活动总量',
            value: stats ? String(stats.total) : '—',
            sub: '已采集入库',
            color: 'text-emerald-400',
          },
          {
            label: 'AI 活动',
            value: stats ? String(stats.by_category?.AI ?? 0) : '—',
            sub: '人工智能相关',
            color: 'text-blue-400',
          },
          {
            label: 'Web3 活动',
            value: stats ? String(stats.by_category?.Web3 ?? 0) : '—',
            sub: '区块链相关',
            color: 'text-orange-400',
          },
          {
            label: '待外联',
            value: stats ? String(stats.uncontacted) : '—',
            sub: stats ? `${stats.contacted} 已联系` : '',
            color: 'text-amber-400',
          },
        ].map((card) => (
          <div
            key={card.label}
            className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-5"
          >
            <p className="text-xs text-zinc-500">{card.label}</p>
            <p className={`mt-2 text-3xl font-bold ${card.color}`}>{card.value}</p>
            <p className="mt-1 text-xs text-zinc-600">{card.sub}</p>
          </div>
        ))}
      </section>

      {/* 快捷入口 */}
      <section>
        <h2 className="text-lg font-semibold mb-4">⚡ 快捷操作</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          <Link
            href="/admin/events"
            className="group rounded-2xl border border-zinc-800 bg-zinc-900/60 p-5 transition hover:border-emerald-700 hover:bg-zinc-900"
          >
            <p className="text-2xl">📅</p>
            <h3 className="mt-2 text-base font-semibold group-hover:text-emerald-400 transition">
              活动浏览器
            </h3>
            <p className="mt-1 text-xs text-zinc-500">
              浏览、筛选、查看所有已采集的高校 AI/Web3 活动及联系方式
            </p>
          </Link>

          <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-5 opacity-60">
            <p className="text-2xl">📨</p>
            <h3 className="mt-2 text-base font-semibold text-zinc-500">
              外联管道
            </h3>
            <p className="mt-1 text-xs text-zinc-600">
              即将上线 — 智能邮件生成 + 批量发送
            </p>
          </div>

          <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-5 opacity-60">
            <p className="text-2xl">📈</p>
            <h3 className="mt-2 text-base font-semibold text-zinc-500">
              趋势洞察
            </h3>
            <p className="mt-1 text-xs text-zinc-600">
              即将上线 — 活动趋势分析 + 报告生成
            </p>
          </div>
        </div>
      </section>

      {/* 后端状态 */}
      <section className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-5">
        <h3 className="text-sm font-semibold text-zinc-400">🔧 系统状态</h3>
        <div className="mt-3 flex items-center gap-4 text-sm">
          <span className={`h-2 w-2 rounded-full ${error ? 'bg-red-500' : 'bg-emerald-500'}`} />
          <span className="text-zinc-400">
            {error ? '后端未连接 — 运行 python manage.py runserver' : '后端 API 正常'}
          </span>
        </div>
        <div className="mt-2 flex items-center gap-4 text-sm">
          <span className="h-2 w-2 rounded-full bg-emerald-500" />
          <span className="text-zinc-400">事件采集 — python manage.py fetch_events</span>
        </div>
        <div className="mt-2 flex items-center gap-4 text-sm">
          <span className="h-2 w-2 rounded-full bg-emerald-500" />
          <a
            href="http://127.0.0.1:8000/admin/"
            target="_blank"
            rel="noopener noreferrer"
            className="text-zinc-400 hover:text-emerald-400 transition"
          >
            Django Admin → 直接管理数据库
          </a>
        </div>
      </section>
    </div>
  );
}
