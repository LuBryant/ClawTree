'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import ConnectWallet from './ConnectWallet';

const links = [
  { href: '/', label: '首页' },
  { href: '/user', label: '用户端' },
  { href: '/demo', label: '现场 Demo' },
  { href: '/admin', label: '运营台' },
];

export default function TopNav() {
  const pathname = usePathname();

  return (
    <nav className="top-nav" aria-label="主导航">
      {links.map(({ href, label }) => {
        const active = href === '/admin'
          ? pathname.startsWith('/admin')
          : pathname === href;
        return (
          <Link
            key={href}
            href={href}
            style={active ? { color: 'var(--success)' } : undefined}
          >
            {label}
          </Link>
        );
      })}
      <a href="https://treefinance.co" target="_blank" rel="noreferrer">
        大树财经
      </a>
      <ConnectWallet />
    </nav>
  );
}
