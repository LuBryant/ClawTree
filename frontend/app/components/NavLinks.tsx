'use client';

import { openChat } from '../lib/chat-store';

export default function NavLinks() {
  return (
    <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-zinc-400">
      <a href="/" className="text-zinc-100 transition hover:text-emerald-400">
        Dashboard
      </a>
      <a href="#" className="transition hover:text-zinc-200">
        活动发现
      </a>
      <a href="#" className="transition hover:text-zinc-200">
        外联管道
      </a>
      <a href="#" className="transition hover:text-zinc-200">
        趋势
      </a>
      <a
        href="#"
        onClick={openChat}
        className="transition hover:text-emerald-400"
      >
        AI客服
      </a>
    </nav>
  );
}
