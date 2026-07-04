'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { userIa } from '../lib/public-data';

export default function UserNavLinks() {
  const pathname = usePathname();

  return (
    <nav className="mb-8 flex gap-2 overflow-x-auto pb-2" aria-label="用户端导航">
      {userIa.map((item) => {
        const active = item.href === '/user'
          ? pathname === '/user'
          : pathname.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`btn-outline btn-sm whitespace-nowrap${active ? ' active' : ''}`}
            style={active ? { borderColor: 'var(--success)', color: 'var(--success)' } : undefined}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
