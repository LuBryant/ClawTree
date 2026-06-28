'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { openChat } from '../lib/chat-store';

const links = [
  { href: '/', label: 'Dashboard' },
  { href: '/events', label: '活动发现' },
];

export default function NavLinks() {
  const pathname = usePathname();

  return (
    <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-zinc-400">
      {links.map(({ href, label }) => {
        const active = pathname === href;
        return (
          <Link
            key={href}
            href={href}
            className={`transition hover:text-zinc-200 ${
              active ? 'text-emerald-400' : ''
            }`}
          >
            {label}
          </Link>
        );
      })}
      <span className="transition text-zinc-600 cursor-not-allowed">
        外联管道
      </span>
      <span className="transition text-zinc-600 cursor-not-allowed">
        趋势
      </span>
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
