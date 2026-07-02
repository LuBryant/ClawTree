'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { openChat } from '../lib/chat-store';

export default function NavLinks() {
  const pathname = usePathname();
  const admin = pathname.startsWith('/admin');

  return (
    <nav className="hidden md:flex items-center gap-6 text-sm" style={{ fontWeight: 900, color: 'var(--text-dim)' }}>
      {admin ? (
        <>
          <Link href="/admin" style={{ color: pathname === '/admin' ? 'var(--success)' : undefined }}
            className="transition hover:brightness-125">
            Dashboard
          </Link>
          <Link href="/admin/events"
            style={{ color: pathname.startsWith('/admin/events') ? 'var(--success)' : undefined }}
            className="transition hover:brightness-125">
            活动浏览器
          </Link>
          <Link href="/admin/reviews"
            style={{ color: pathname.startsWith('/admin/reviews') ? 'var(--success)' : undefined }}
            className="transition hover:brightness-125">
            活动回顾
          </Link>
          <span style={{ color: 'rgba(255,255,255,0.2)' }}>外联管道</span>
          <span style={{ color: 'rgba(255,255,255,0.2)' }}>趋势洞察</span>
          <span className="ml-4 text-xs font-black uppercase tracking-wider" style={{ color: 'var(--warning)' }}>管理端</span>
          <Link href="/" className="text-xs transition hover:brightness-150" style={{ color: 'var(--muted)' }}>
            ← 返回用户端
          </Link>
        </>
      ) : (
        <>
          <Link href="/" style={{ color: pathname === '/' ? 'var(--success)' : undefined }}
            className="transition hover:brightness-125">首页</Link>
          <Link href="/admin/reviews" className="transition hover:brightness-125">活动回顾</Link>
          <a href="#" onClick={openChat} className="transition" style={{ color: 'var(--success)' }}>AI客服</a>
          <Link href="/admin" className="ml-4 text-xs font-black uppercase tracking-wider"
            style={{ border: '1px solid rgba(248,214,109,0.42)', background: 'rgba(248,214,109,0.1)', color: 'var(--warning)', padding: '5px 12px' }}>
            管理端
          </Link>
        </>
      )}
    </nav>
  );
}
