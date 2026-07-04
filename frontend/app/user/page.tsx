'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { publicRecaps, publicSignals } from '../lib/public-data';
import { fetchEvents, type UniversityEvent } from '../lib/api-client';

const PS = 12;
const formatDate = (s: string | null) => {
  if (!s) return '';
  return new Date(s).toLocaleDateString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit' });
};

export default function UserHomePage() {
  const heroSignal = publicSignals[0];
  const heroRecap = publicRecaps[0];
  const [heroEvent, setHeroEvent] = useState<UniversityEvent | null>(null);

  useEffect(() => {
    fetchEvents({ ordering: '-event_date', page: 1 }).then((d) => {
      if (d.results.length > 0) setHeroEvent(d.results[0]);
    }).catch(() => {});
  }, []);

  return (
    <div className="flex flex-col gap-8">
      <section className="grid gap-4 lg:grid-cols-[1.25fr_.75fr]">
        <article className="panel p-6">
          <span className="badge badge-success">15 秒理解</span>
          <h2 className="mt-5 text-3xl font-black leading-tight tracking-tight md:text-5xl">
            不用翻 X，也能看见大树财经的高校内容与合作入口。
          </h2>
          <p className="mt-5 max-w-3xl text-sm leading-7 md:text-base" style={{ color: 'var(--text-dim)' }}>
            ClawTree 把公开来源、发布时间、抓取时间、AI 摘要和编辑说明放在同一个页面里。老师看的是可信回顾和活动机会；运营端再把这些信号变成可审批的逐校提案。
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link href="/user/recaps" className="btn btn-success">看大树回顾</Link>
            <Link href="/user/events" className="btn-outline">找近期活动</Link>
            <Link href="/user/cooperate" className="btn-outline">申请合作</Link>
          </div>
        </article>
        <aside className="panel p-6">
          <p className="text-xs font-black uppercase tracking-widest" style={{ color: 'var(--warning)' }}>可信边界</p>
          {[
            '所有公开事实保留来源 URL、发布时间、抓取/核验时间。',
            'AI 只做摘要、分类和建议；发布与外联必须人审。',
            '公开端不返回邮箱、内部评分、风险原文或 prompt。',
          ].map((item) => (
            <p key={item} className="mt-4 border-l-2 border-[var(--success)] pl-3 text-sm leading-6" style={{ color: 'var(--text-dim)' }}>
              {item}
            </p>
          ))}
        </aside>
      </section>

      <section className="grid gap-4 lg:grid-cols-3">
        <article className="panel p-5">
          <span className="badge badge-info">Signal</span>
          <h3 className="mt-4 text-xl font-black">{heroSignal.title}</h3>
          <p className="mt-3 text-sm leading-6" style={{ color: 'var(--muted)' }}>{heroSignal.summary}</p>
          <p className="mt-4 text-xs" style={{ color: 'var(--text-dim)' }}>
            来源：{heroSignal.publisher} · {heroSignal.publishedDate}
          </p>
          <Link href="/user/signals" className="mt-5 inline-flex text-sm font-black" style={{ color: 'var(--info)' }}>查看全部信号 →</Link>
        </article>
        <article className="panel p-5">
          <span className="badge badge-success">Recap</span>
          <h3 className="mt-4 text-xl font-black">{heroRecap.title}</h3>
          <p className="mt-3 text-sm leading-6" style={{ color: 'var(--muted)' }}>{heroRecap.summary}</p>
          <p className="mt-4 text-xs" style={{ color: 'var(--text-dim)' }}>
            编辑状态：{heroRecap.editorialStatus} · {heroRecap.fetchedDate}
          </p>
          <Link href="/user/recaps" className="mt-5 inline-flex text-sm font-black" style={{ color: 'var(--success)' }}>阅读回顾 →</Link>
        </article>
        {heroEvent ? (
          <article className="panel p-5">
            <span className="badge badge-warning">Event</span>
            <h3 className="mt-4 text-xl font-black">
              {heroEvent.source_url ? (
                <a href={heroEvent.source_url} target="_blank" rel="noopener noreferrer" className="hover:underline">{heroEvent.title}</a>
              ) : heroEvent.title}
            </h3>
            <p className="mt-3 text-sm leading-6" style={{ color: 'var(--muted)' }}>
              {heroEvent.university || '未知高校'}
              {heroEvent.event_date && ` · ${formatDate(heroEvent.event_date)}`}
              {heroEvent.location && ` · ${heroEvent.location}`}
            </p>
            <p className="mt-4 text-xs" style={{ color: 'var(--text-dim)' }}>
              公开端不展示联系邮箱、内部评分、风险原文或 prompt。
            </p>
            <Link href="/user/events" className="mt-5 inline-flex text-sm font-black" style={{ color: 'var(--warning)' }}>查看活动 →</Link>
          </article>
        ) : (
          <article className="panel p-5 flex items-center justify-center" style={{ minHeight: 180 }}>
            <div className="spinner" />
          </article>
        )}
      </section>
    </div>
  );
}
