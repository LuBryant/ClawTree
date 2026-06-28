'use client';

import Link from 'next/link';

export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-10 px-6 py-12">
      {/* Hero */}
      <section className="flex flex-col items-center text-center gap-5 py-14"
        style={{
          background: 'linear-gradient(115deg, rgba(255,61,87,0.18), transparent 36%), linear-gradient(245deg, rgba(22,242,179,0.12), transparent 34%), rgba(7,9,14,0.78)',
          border: '1px solid var(--line)',
          boxShadow: '0 24px 70px rgba(0,0,0,0.28)',
        }}
      >
        <span className="text-6xl">🌳</span>
        <p className="text-xs font-black uppercase tracking-widest" style={{ color: 'var(--success)' }}>
          AI Agent × Web3 × 高校生态
        </p>
        <h1 className="max-w-2xl font-normal leading-none tracking-tight"
          style={{ fontSize: 'clamp(2rem, 5vw, 3.8rem)' }}>
          树爪智动 · 高校 AI/Web3 活动平台
        </h1>
        <p className="max-w-xl text-base leading-relaxed" style={{ color: 'var(--text-dim)' }}>
          由 ClawTree AI Agent 驱动，发现前沿高校 AI/Web3 活动，
          浏览往期精彩回顾，连接产业、资本与高校人才生态。
        </p>
        <div className="flex gap-3 mt-4">
          <Link href="/admin" className="btn btn-warning">管理端入口</Link>
          <button className="btn-outline" onClick={() => { const { openChat } = require('./lib/chat-store'); openChat(); }}>
            💬 AI 客服
          </button>
        </div>
      </section>

      {/* 核心能力 */}
      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { icon: '🔍', title: '活动发现', desc: 'AI 自动检索高校 AI/Web3 活动，聚合讲座、黑客松、论坛等信息' },
          { icon: '🤝', title: '智能外联', desc: 'AI 生成个性化邮件，批量联系高校主办方，促成合作' },
          { icon: '📸', title: '活动回顾', desc: '高校行照片、演讲内容总结、精彩瞬间回顾' },
          { icon: '💬', title: 'AI 客服', desc: '24/7 在线，解答合作模式、活动流程、资源支持等问题' },
        ].map((item) => (
          <div key={item.title} className="panel text-center" style={{ padding: '20px' }}>
            <p className="text-3xl mb-3">{item.icon}</p>
            <h3 className="text-sm font-black uppercase tracking-wider">{item.title}</h3>
            <p className="mt-1.5 text-xs leading-relaxed" style={{ color: 'var(--muted)' }}>{item.desc}</p>
          </div>
        ))}
      </section>

      {/* 往期高校行 */}
      <section>
        <h2 className="text-sm font-black uppercase tracking-widest mb-5">📸 往期高校行</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {[
            { school: '清华大学', event: 'AI 前沿论坛', date: '2026 年 5 月', desc: '汇聚国内外 AI 顶尖学者，探讨大模型、具身智能前沿。' },
            { school: '浙江大学', event: 'ZJU Hack 2026', date: '2026 年 4 月', desc: '48 小时 Web3 黑客松，覆盖 DeFi、NFT、DAO 赛道。' },
            { school: '上海交通大学', event: 'AI × Web3 交叉论坛', date: '2026 年 3 月', desc: '去中心化 AI、ZKML 与联邦学习的学术前沿探讨。' },
          ].map((item) => (
            <div key={item.school} className="panel event-card" style={{ padding: '18px' }}>
              <p className="text-xs font-black uppercase tracking-wider" style={{ color: 'var(--success)' }}>{item.date}</p>
              <h3 className="mt-1 text-base font-bold">{item.event}</h3>
              <p className="text-sm mt-0.5" style={{ color: 'var(--text-dim)' }}>{item.school}</p>
              <p className="mt-2 text-xs leading-relaxed" style={{ color: 'var(--muted)' }}>{item.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* 页脚 */}
      <footer className="mt-8 text-center text-xs py-6" style={{ borderTop: '1px solid var(--line)', color: 'var(--muted)' }}>
        <p>ClawTree（树爪智动）· OpenClaw AI Agent · HTX Genesis Hackathon</p>
        <p className="mt-1">
          管理入口 → <Link href="/admin" style={{ color: 'var(--warning)' }} className="hover:underline font-bold">/admin</Link>
        </p>
      </footer>
    </main>
  );
}
