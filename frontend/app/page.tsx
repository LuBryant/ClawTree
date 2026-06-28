'use client';

import { useEffect, useState } from 'react';
import { useAccount } from 'wagmi';
import { useTronWallet } from './hooks/useTronWallet';
import { fetchEventStats, type EventStats } from './lib/api-client';
import Link from 'next/link';

export default function Home() {
  const { isConnected: evmConnected, address: evmAddress } = useAccount();
  const tron = useTronWallet();
  const isConnected = tron.isConnected || evmConnected;

  const [stats, setStats] = useState<EventStats | null>(null);
  const [statsErr, setStatsErr] = useState(false);

  useEffect(() => {
    fetchEventStats()
      .then(setStats)
      .catch(() => setStatsErr(true));
  }, []);

  return (
    <main className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-8 px-6 py-10">
      {/* Hero */}
      <section className="flex flex-col gap-3">
        <p className="text-xs font-semibold uppercase tracking-widest text-emerald-400">
          AI Agent × Web3 × 高校生态
        </p>
        <h1 className="max-w-2xl text-4xl font-bold leading-tight tracking-tight">
          让 AI 替你发现高校活动、智能外联、形成趋势
        </h1>
        <p className="max-w-xl text-base leading-relaxed text-zinc-400">
          ClawTree 基于 OpenClaw AI Agent 构建，自动检索高校 AI/Web3 活动、
          智能个性化外联官方邮箱、回复解析与 Dashboard 可视化，
          大幅提升组织效率 70%+。
        </p>
      </section>

      {/* Stats row */}
      <section className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {[
          {
            label: '已聚合活动',
            value: stats ? String(stats.total) : '—',
            hint: statsErr ? '后端未连接' : '覆盖 AI / Web3 / AI+Web3',
          },
          {
            label: '待外联高校',
            value: stats ? String(stats.uncontacted) : '—',
            hint: statsErr ? '启动后端查看' : `${stats?.contacted ?? 0} 已联系`,
          },
          {
            label: 'AI+Web3 活动',
            value: stats ? String(stats.by_category?.['AI+Web3'] ?? 0) : '—',
            hint: statsErr ? 'python manage.py runserver' : '跨界融合活动',
          },
        ].map((stat) => (
          <div
            key={stat.label}
            className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-5 transition hover:border-zinc-700"
          >
            <p className="text-xs text-zinc-500">{stat.label}</p>
            <p className="mt-1 text-3xl font-bold tracking-tight">{stat.value}</p>
            <p className="mt-0.5 text-xs text-zinc-600">{stat.hint}</p>
          </div>
        ))}
      </section>

      {/* Quick links */}
      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Link
          href="/events"
          className="group rounded-2xl border border-zinc-800 bg-zinc-900/60 p-6 transition hover:border-emerald-700 hover:bg-zinc-900"
        >
          <h3 className="text-lg font-semibold group-hover:text-emerald-400 transition">
            📅 活动浏览器
          </h3>
          <p className="mt-1 text-sm text-zinc-500">
            浏览所有已采集的高校 AI/Web3 活动，按分类、高校、日期筛选，查看联系方式。
          </p>
        </Link>

        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-6 opacity-70">
          <h3 className="text-lg font-semibold">📨 外联管道</h3>
          <p className="mt-1 text-sm text-zinc-600">
            即将上线 — AI 智能外联邮件 + 回复解析
          </p>
        </div>
      </section>

      {/* Chain status card */}
      <section className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-6">
        <h2 className="text-lg font-semibold">⛓️ 链上状态 · TRON Nile Testnet</h2>
        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="flex items-center gap-2 text-sm">
            <span className="h-2 w-2 rounded-full bg-emerald-500" />
            <span className="text-zinc-400">RPC:</span>
            <code className="text-xs text-zinc-500">nile.trongrid.io</code>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <span className="h-2 w-2 rounded-full bg-emerald-500" />
            <span className="text-zinc-400">Chain ID:</span>
            <code className="text-xs text-zinc-500">3448148188</code>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <span className={`h-2 w-2 rounded-full ${isConnected ? 'bg-emerald-500' : 'bg-zinc-600'}`} />
            <span className="text-zinc-400">钱包:</span>
            <span className={`text-xs ${isConnected ? 'text-emerald-400' : 'text-zinc-600'}`}>
              {isConnected
                ? `${(tron.address || evmAddress || '').slice(0, 10)}…`
                : '点击 TronLink 或 MetaMask 连接'}
            </span>
          </div>
        </div>

        {/* Contract addresses */}
        <div className="mt-5 space-y-1.5 border-t border-zinc-800 pt-4">
          <p className="text-xs font-semibold text-zinc-500">已部署合约</p>
          {[
            ['EventRegistry', ''],
            ['OutreachRecord', ''],
            ['TrendOracle', ''],
          ].map(([name, addr]) => (
            <div key={name} className="flex items-center gap-3 text-xs">
              <code className="w-36 text-zinc-400">{name}</code>
              <code className={addr ? 'text-emerald-400' : 'text-zinc-700'}>
                {addr || '未部署 · 运行 npm run deploy:nile'}
              </code>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
