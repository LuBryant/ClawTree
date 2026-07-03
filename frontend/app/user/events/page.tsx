import Link from 'next/link';
import { publicEvents } from '../../lib/public-data';

export default function UserEventsPage() {
  return (
    <div className="flex flex-col gap-5">
      <section className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <h2 className="text-3xl font-black tracking-tight">近期高校活动</h2>
          <p className="mt-2 text-sm" style={{ color: 'var(--muted)' }}>
            只展示已核验或待复核但未过期活动；公开端不展示联系点。
          </p>
        </div>
        <span className="badge badge-success">expired hidden · contact hidden</span>
      </section>
      <div className="grid gap-4 md:grid-cols-2">
        {publicEvents.map((event) => (
          <article key={event.id} className="panel p-5">
            <div className="flex flex-wrap gap-2">
              <span className={event.status === '已核验' ? 'badge badge-success' : 'badge badge-warning'}>{event.status}</span>
              <span className="badge">{event.sourceLabel}</span>
              <span className="badge">{event.city}</span>
            </div>
            <h3 className="mt-4 text-xl font-black">{event.title}</h3>
            <p className="mt-3 text-sm leading-7" style={{ color: 'var(--text-dim)' }}>
              时间：{event.startsDate} · 可信度：{event.credibility}
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              {(event.tags ?? []).map((tag) => <span key={tag} className="badge">{tag}</span>)}
            </div>
            <p className="mt-5 text-xs leading-6" style={{ color: 'var(--muted)' }}>{event.publicNote}</p>
            <div className="mt-5 flex flex-wrap gap-3">
              <Link href={event.registrationUrl} className="btn-outline btn-sm">报名/详情入口</Link>
              <span className="btn-outline btn-sm" aria-disabled>联系信息仅管理端</span>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
