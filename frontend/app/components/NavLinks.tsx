'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { openChat } from '../lib/chat-store';

const isAdmin = (pathname: string) => pathname.startsWith('/admin');

export default function NavLinks() {
  const pathname = usePathname();
  const admin = isAdmin(pathname);

  return (
    <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-zinc-400">
      {admin ? (
        <>
          {/* 管理端导航 */}
          <Link
            href="/admin"
            className={`transition hover:text-zinc-200 ${
              pathname === '/admin' ? 'text-amber-400' : ''
            }`}
          >
            Dashboard
          </Link>
          <Link
            href="/admin/events"
            className={`transition hover:text-zinc-200 ${
              pathname.startsWith('/admin/events') ? 'text-amber-400' : ''
            }`}
          >
            活动浏览器
          </Link>
          <span className="text-zinc-600 cursor-not-allowed">外联管道</span>
          <span className="text-zinc-600 cursor-not-allowed">趋势洞察</span>
          <span className="ml-4 text-xs text-amber-600 font-semibold uppercase tracking-wider">
            管理端
          </span>
          <Link href="/" className="text-xs text-zinc-600 hover:text-zinc-400 transition">
            ← 返回用户端
          </Link>
        </>
      ) : (
        <>
          {/* 普通用户端导航 */}
          <Link
            href="/"
            className={`transition hover:text-zinc-200 ${
              pathname === '/' ? 'text-emerald-400' : ''
            }`}
          >
            首页
          </Link>
          <span className="transition text-zinc-500 cursor-pointer hover:text-zinc-300">
            活动回顾
          </span>
          <a
            href="#"
            onClick={openChat}
            className="transition hover:text-emerald-400"
          >
            AI客服
          </a>
          <Link
            href="/admin"
            className="ml-4 rounded-lg border border-amber-800 px-3 py-1 text-xs text-amber-500 hover:border-amber-600 hover:text-amber-400 transition"
          >
            管理端
          </Link>
        </>
      )}
    </nav>
  );
}
