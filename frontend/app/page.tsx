'use client';

import Link from 'next/link';

export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-8 px-6 py-10">
      {/* Hero */}
      <section className="flex flex-col items-center text-center gap-4 py-10">
        <span className="text-6xl">🌳</span>
        <p className="text-xs font-semibold uppercase tracking-widest text-emerald-400">
          AI Agent × Web3 × 高校生态
        </p>
        <h1 className="max-w-2xl text-4xl font-bold leading-tight tracking-tight">
          大树财经 · 高校 AI/Web3 活动平台
        </h1>
        <p className="max-w-xl text-base leading-relaxed text-zinc-400">
          由 ClawTree AI Agent 驱动，发现前沿高校 AI/Web3 活动，
          浏览往期精彩回顾，连接产业、资本与高校人才生态。
        </p>
        <div className="flex gap-4 mt-4">
          <Link
            href="/admin"
            className="rounded-xl bg-amber-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-amber-500 transition"
          >
            管理端入口
          </Link>
          <button
            className="rounded-xl border border-zinc-700 px-5 py-2.5 text-sm text-zinc-300 hover:border-zinc-500 transition"
            onClick={() => {
              const { openChat } = require('./lib/chat-store');
              openChat();
            }}
          >
            💬 AI 客服
          </button>
        </div>
      </section>

      {/* 核心能力 */}
      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          {
            icon: '🔍',
            title: '活动发现',
            desc: 'AI 自动检索高校 AI/Web3 活动，聚合讲座、黑客松、论坛等信息',
          },
          {
            icon: '🤝',
            title: '智能外联',
            desc: 'AI 生成个性化邮件，批量联系高校主办方，促成合作',
          },
          {
            icon: '📸',
            title: '活动回顾',
            desc: '高校行照片、演讲内容总结、精彩瞬间回顾',
          },
          {
            icon: '💬',
            title: 'AI 客服',
            desc: '24/7 在线，解答合作模式、活动流程、资源支持等问题',
          },
        ].map((item) => (
          <div
            key={item.title}
            className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-5 text-center"
          >
            <p className="text-3xl">{item.icon}</p>
            <h3 className="mt-3 text-sm font-semibold">{item.title}</h3>
            <p className="mt-1 text-xs text-zinc-500 leading-relaxed">{item.desc}</p>
          </div>
        ))}
      </section>

      {/* 往期精彩 */}
      <section>
        <h2 className="text-xl font-bold mb-4">📸 往期高校行</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {[
            {
              school: '清华大学',
              event: 'AI 前沿论坛',
              date: '2026 年 5 月',
              desc: '汇聚国内外 AI 顶尖学者，探讨大模型、具身智能前沿。',
            },
            {
              school: '浙江大学',
              event: 'ZJU Hack 2026',
              date: '2026 年 4 月',
              desc: '48 小时 Web3 黑客松，覆盖 DeFi、NFT、DAO 赛道。',
            },
            {
              school: '上海交通大学',
              event: 'AI × Web3 交叉论坛',
              date: '2026 年 3 月',
              desc: '去中心化 AI、ZKML 与联邦学习的学术前沿探讨。',
            },
          ].map((item) => (
            <div
              key={item.school}
              className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-5 transition hover:border-zinc-700"
            >
              <p className="text-xs text-emerald-400 font-medium">{item.date}</p>
              <h3 className="mt-1 text-base font-semibold">{item.event}</h3>
              <p className="text-sm text-zinc-400">{item.school}</p>
              <p className="mt-2 text-xs text-zinc-500 leading-relaxed">{item.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* 页脚 */}
      <footer className="mt-10 border-t border-zinc-800 pt-6 text-center text-xs text-zinc-600">
        <p>
          ClawTree（树爪智动）· 基于 OpenClaw AI Agent 构建 · HTX Genesis Hackathon
        </p>
        <p className="mt-1">
          管理入口 → <Link href="/admin" className="text-amber-500 hover:underline">/admin</Link>
        </p>
      </footer>
    </main>
  );
}
