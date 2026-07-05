'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { publicRecaps, publicSignals } from '../lib/public-data';
import { fetchEvents, type UniversityEvent } from '../lib/api-client';
import { useLanguage } from '../i18n/LanguageProvider';
import { DEMO_WORKSPACE } from '../config/workspaces';

export default function UserHomePage() {
  const heroSignal = publicSignals[0];
  const heroRecap = publicRecaps[0];
  const [heroEvent, setHeroEvent] = useState<UniversityEvent | null>(null);
  const { locale, tx } = useLanguage();
  const formatDate = (s: string | null) => s ? new Date(s).toLocaleDateString(locale, { year: 'numeric', month: '2-digit', day: '2-digit' }) : '';

  useEffect(() => {
    fetchEvents({ ordering: '-event_date', page: 1 }).then((d) => {
      if (d.results.length > 0) setHeroEvent(d.results[0]);
    }).catch(() => {});
  }, []);

  return (
    <div className="flex flex-col gap-8">
      <section className="grid gap-4 lg:grid-cols-[1.25fr_.75fr]">
        <article className="panel p-6">
          <span className="badge badge-success">{tx('15 秒理解', 'Understand in 15 seconds')}</span>
          <h2 className="mt-5 text-3xl font-black leading-tight tracking-tight md:text-5xl">
            {tx(`不用翻 X，也能看见${DEMO_WORKSPACE.name}的高校内容与合作入口。`, `See ${DEMO_WORKSPACE.nameEn} campus content and partnership opportunities—without digging through X.`)}
          </h2>
          <p className="mt-5 max-w-3xl text-sm leading-7 md:text-base" style={{ color: 'var(--text-dim)' }}>
            {tx('ClawTree 把公开来源、发布时间、抓取时间、AI 摘要和编辑说明放在同一个页面里。老师看的是可信回顾和活动机会；运营端再把这些信号变成可审批的逐校提案。', 'ClawTree brings public sources, timestamps, AI summaries, and editorial notes together. Educators see trusted recaps and events; operators turn those signals into reviewable, campus-specific proposals.')}
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link href="/user/recaps" className="btn btn-success">{tx('查看客户回顾', 'View workspace recaps')}</Link>
            <Link href="/user/events" className="btn-outline">{tx('找近期活动', 'Find events')}</Link>
            <Link href="/user/cooperate" className="btn-outline">{tx('申请合作', 'Partner with us')}</Link>
          </div>
        </article>
        <aside className="panel p-6">
          <p className="text-xs font-black uppercase tracking-widest" style={{ color: 'var(--warning)' }}>{tx('可信边界', 'Trust boundaries')}</p>
          {[
            tx('所有公开事实保留来源 URL、发布时间、抓取/核验时间。', 'Every public fact retains its source URL, publish time, and verification time.'),
            tx('AI 只做摘要、分类和建议；发布与外联必须人审。', 'AI summarizes, classifies, and suggests; publishing and outreach require human review.'),
            tx('公开端不返回邮箱、内部评分、风险原文或 prompt。', 'The public portal never exposes emails, internal scores, raw risk text, or prompts.'),
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
            {tx('来源', 'Source')}: {heroSignal.publisher} · {heroSignal.publishedDate}
          </p>
          <Link href="/user/signals" className="mt-5 inline-flex text-sm font-black" style={{ color: 'var(--info)' }}>{tx('查看全部信号', 'View all signals')} →</Link>
        </article>
        <article className="panel p-5">
          <span className="badge badge-success">Recap</span>
          <h3 className="mt-4 text-xl font-black">{heroRecap.title}</h3>
          <p className="mt-3 text-sm leading-6" style={{ color: 'var(--muted)' }}>{heroRecap.summary}</p>
          <p className="mt-4 text-xs" style={{ color: 'var(--text-dim)' }}>
            {tx('编辑状态', 'Editorial status')}: {heroRecap.editorialStatus} · {heroRecap.fetchedDate}
          </p>
          <Link href="/user/recaps" className="mt-5 inline-flex text-sm font-black" style={{ color: 'var(--success)' }}>{tx('阅读回顾', 'Read recaps')} →</Link>
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
              {heroEvent.university || tx('未知高校', 'University pending')}
              {heroEvent.event_date && ` · ${formatDate(heroEvent.event_date)}`}
              {heroEvent.location && ` · ${heroEvent.location}`}
            </p>
            <p className="mt-4 text-xs" style={{ color: 'var(--text-dim)' }}>
              {tx('公开端不展示联系邮箱、内部评分、风险原文或 prompt。', 'Contact emails, internal scores, raw risk text, and prompts stay private.')}
            </p>
            <Link href="/user/events" className="mt-5 inline-flex text-sm font-black" style={{ color: 'var(--warning)' }}>{tx('查看活动', 'View event')} →</Link>
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
