import Link from 'next/link';
import UserNavLinks from '../components/UserNavLinks';

export default function UserLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="shell section-block">
      <div className="mb-8 flex flex-col gap-4 border border-[var(--line)] bg-[rgba(12,17,27,.82)] p-4 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="eyebrow">PUBLIC PORTAL / APPROVED ONLY</p>
          <h1 className="mt-2 text-2xl font-black tracking-tight md:text-4xl">ClawTree 用户端</h1>
          <p className="mt-2 max-w-2xl text-sm leading-7" style={{ color: 'var(--muted)' }}>
            给高校老师、学生和合作方看的可信内容入口；公开端不展示联系邮箱、内部评分、风险原文、模型 prompt 或回复内容。
          </p>
        </div>
        <Link href="/admin" className="btn-outline whitespace-nowrap">切到运营端 →</Link>
      </div>
      <UserNavLinks />
      {children}
    </main>
  );
}
