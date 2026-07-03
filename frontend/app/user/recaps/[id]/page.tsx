import Link from 'next/link';
import { notFound } from 'next/navigation';
import { publicRecaps } from '../../../lib/public-data';

export async function generateStaticParams() {
  return publicRecaps.map((recap) => ({ id: recap.slug }));
}

export default async function UserRecapDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const recap = publicRecaps.find((item) => item.slug === id);
  if (!recap) notFound();

  return (
    <article className="mx-auto max-w-3xl panel p-6">
      <Link href="/user/recaps" className="text-sm font-black" style={{ color: 'var(--info)' }}>← 返回回顾列表</Link>
      <div className="mt-6 flex flex-wrap gap-2">
        <span className="badge badge-success">{recap.editorialStatus}</span>
        <span className={recap.riskLevel === 'high' ? 'badge badge-warning' : 'badge'}>risk: {recap.riskLevel}</span>
        {recap.tags.map((tag) => <span key={tag} className="badge">{tag}</span>)}
      </div>
      <h2 className="mt-6 text-3xl font-black leading-tight tracking-tight">{recap.title}</h2>
      <p className="mt-5 text-base leading-8" style={{ color: 'var(--text-dim)' }}>{recap.summary}</p>
      <section className="mt-6 grid gap-3 border border-[var(--line)] p-4 text-sm" style={{ color: 'var(--muted)' }}>
        <p>原发布时间：{recap.publishedDate}</p>
        <p>本站抓取/核验：{recap.fetchedDate}</p>
        <p>编辑说明：{recap.editorNote}</p>
        <p>公开边界：无授权媒体不复制展示；AI 建议不覆盖原文；真实发布必须人审。</p>
      </section>
      <a href={recap.sourceUrl} target="_blank" rel="noreferrer" className="mt-6 inline-flex btn-outline">
        查看原始来源 ↗
      </a>
    </article>
  );
}
