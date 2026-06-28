'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const adminLinks = [
  { href: '/admin', label: '📊 Dashboard', exact: true },
  { href: '/admin/events', label: '📅 活动浏览器', exact: false },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-1 gap-8 px-6 py-10">
      {/* 左侧导航 */}
      <aside className="hidden w-52 shrink-0 lg:block">
        <div className="sticky top-20 flex flex-col gap-1">
          <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-amber-500">
            管理端
          </p>
          {adminLinks.map(({ href, label, exact }) => {
            const active = exact
              ? pathname === href
              : pathname.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                className={`rounded-xl px-4 py-2.5 text-sm font-medium transition ${
                  active
                    ? 'bg-amber-950/50 text-amber-400 border border-amber-800/50'
                    : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-900'
                }`}
              >
                {label}
              </Link>
            );
          })}
        </div>
      </aside>

      {/* 右侧内容 */}
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
