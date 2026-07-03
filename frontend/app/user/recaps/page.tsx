import Link from 'next/link';
import { publicRecaps } from '../../lib/public-data';

export default function UserRecapsPage() {
  return (
    <div className="flex flex-col gap-5">
      <section>
        <h2 className="text-3xl font-black tracking-tight">大树活动回顾</h2>
        <p className="mt-2 text-sm" style={{ color: 'var(--muted)' }}>
          只展示已批准的公开摘要、来源、发布时间和编辑说明；不复制未授权全文。
        </p>
      </section>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {publicRecaps.map((recap) => (
          <article key={recap.id} className="panel p-5">
            <div className="flex flex-wrap gap-2">
              <span className="badge badge-success">{recap.editorialStatus}</span>
              <span className={recap.riskLevel === 'high' ? 'badge badge-warning' : 'badge'}>risk: {recap.riskLevel}</span>
            </div>
            <h3 className="mt-4 text-lg font-black leading-snug">{recap.title}</h3>
            <p className="mt-3 text-sm leading-7" style={{ color: 'var(--text-dim)' }}>{recap.summary}</p>
            <p className="mt-4 text-xs" style={{ color: 'var(--muted)' }}>
              原发布时间：{recap.publishedDate} · 本站核验：{recap.fetchedDate}
            </p>
            <Link href={'/user/recaps/' + recap.slug} className="mt-5 inline-flex text-sm font-black" style={{ color: 'var(--success)' }}>
              查看详情 →
            </Link>
          </article>
        ))}
      </div>
    </div>
  );
}
