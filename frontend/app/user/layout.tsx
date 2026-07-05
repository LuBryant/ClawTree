'use client';

import Link from 'next/link';
import UserNavLinks from '../components/UserNavLinks';
import { useLanguage } from '../i18n/LanguageProvider';
import { DEMO_WORKSPACE } from '../config/workspaces';

export default function UserLayout({ children }: { children: React.ReactNode }) {
  const { tx } = useLanguage();
  return (
    <main className="shell section-block">
      <div className="mb-8 flex flex-col gap-4 border border-[var(--line)] bg-[rgba(12,17,27,.82)] p-4 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="eyebrow">PUBLIC PORTAL / {DEMO_WORKSPACE.slug.toUpperCase()} / APPROVED ONLY</p>
          <h1 className="mt-2 text-2xl font-black tracking-tight md:text-4xl">{tx(DEMO_WORKSPACE.publicPortalTitle, DEMO_WORKSPACE.publicPortalTitleEn)}</h1>
          <p className="mt-2 max-w-2xl text-sm leading-7" style={{ color: 'var(--muted)' }}>
            {tx('这里用大树财经高校行作为 ClawTree 的演示案例，展示一个媒体活动品牌如何把公开内容和高校机会变成可审核的合作流程；联系邮箱、内部评分、风险原文、模型 prompt 和回复始终留在受控后台。', 'This page uses TreeFinance campus tour as a ClawTree demo case, showing how a media/events brand can turn public content and campus opportunities into a reviewable partnership workflow while contacts, internal scores, raw risk text, prompts, and replies stay in the controlled backend.')}
          </p>
        </div>
        <Link href="/admin" className="btn-outline whitespace-nowrap">{tx('切到运营端', 'Open Operations')} →</Link>
      </div>
      <UserNavLinks />
      {children}
    </main>
  );
}
