'use client';

import { useEffect, useState, useCallback } from 'react';
import Image from 'next/image';
import {
  fetchReviews, fetchTweetReviews,
  type EventReview,
  type TweetReview,
} from '../../lib/api-client';
import { useLanguage } from '../../i18n/LanguageProvider';

const SOURCE_COLORS: Record<string, string> = {
  manual: 'var(--success)',
  twitter: 'var(--info)',
};
const SOURCE_BGS: Record<string, string> = {
  manual: 'rgba(22,242,179,0.12)',
  twitter: 'rgba(120,166,255,0.12)',
};
const SOURCE_LABEL: Record<string, string> = {
  manual: '手动',
  twitter: 'Twitter',
};

type MergedCard =
  | { key: string; type: 'manual'; data: EventReview }
  | { key: string; type: 'tweet'; data: TweetReview };

const PS = 12;

export default function UserRecapsPage() {
  const { locale, tx } = useLanguage();
  const [allCards, setAllCards] = useState<MergedCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [searchText, setSearchText] = useState('');
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const formatDate = (s: string | null) => {
    if (!s) return '';
    return new Date(s).toLocaleDateString(locale, {
      year: 'numeric', month: '2-digit', day: '2-digit',
    });
  };

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const [manualRes, tweetRes] = await Promise.all([
        fetchReviews({ ordering: '-created_at' }),
        fetchTweetReviews({ ordering: '-published_at' }),
      ]);

      const merged: MergedCard[] = [
        ...manualRes.results.map((r) => ({ key: `m-${r.id}`, type: 'manual' as const, data: r })),
        ...tweetRes.results.map((t) => ({ key: `t-${t.id}`, type: 'tweet' as const, data: t })),
      ];
      merged.sort((a, b) => {
        const da = a.type === 'manual'
          ? (a.data.published_at || a.data.created_at)
          : (a.data.published_at || a.data.created_at);
        const db = b.type === 'manual'
          ? (b.data.published_at || b.data.created_at)
          : (b.data.published_at || b.data.created_at);
        return new Date(db).getTime() - new Date(da).getTime();
      });

      setAllCards(merged);
    } catch {
      setError(tx('无法连接后端 API，请确保服务正在运行', 'Unable to reach the backend API. Please ensure the service is running.'));
    } finally {
      setLoading(false);
    }
  }, [tx]);

  useEffect(() => {
    const timer = window.setTimeout(() => { void load(); }, 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  const filtered = searchText
    ? allCards.filter((c) => {
        const t = c.type === 'manual' ? c.data.title : (c.data.summary || '');
        const txt = c.type === 'manual' ? (c.data.content || '') : (c.data.text_processed || c.data.text || '');
        const q = searchText.toLowerCase();
        return t.toLowerCase().includes(q) || txt.toLowerCase().includes(q);
      })
    : allCards;

  const totalPages = Math.max(1, Math.ceil(filtered.length / PS));
  const paged = filtered.slice((page - 1) * PS, page * PS);

  const doSearch = () => { setSearchText(search); setPage(1); };
  const toggleExpand = (id: string) => setExpanded((p) => {
    const n = new Set(p);
    if (n.has(id)) n.delete(id); else n.add(id);
    return n;
  });

  return (
    <div className="flex flex-col gap-6">
      <section>
        <h2 className="text-3xl font-black tracking-tight">{tx('大树活动回顾', 'TreeFinance Event Recaps')}</h2>
        <p className="mt-2 text-sm" style={{ color: 'var(--muted)' }}>
          {tx('来自 Twitter、手动整理等来源的往期活动回顾', 'Past event recaps from Twitter and editorial sources')}
          {filtered.length > 0 && <span> — <span style={{ color: 'var(--success)', fontWeight: 950 }}>{filtered.length}</span> {tx('篇', 'recaps')}</span>}
        </p>
      </section>

      <section className="flex flex-wrap items-center gap-3">
        <input type="text" value={search} onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && doSearch()}
          placeholder={tx('搜索回顾…', 'Search recaps…')} className="input-field w-full sm:w-64" />
        <button className="btn btn-success btn-sm" onClick={doSearch}>{tx('搜索', 'Search')}</button>
      </section>

      {error && (
        <div className="text-center py-8" style={{ border: '1px solid rgba(255,61,87,0.42)', background: 'rgba(255,61,87,0.08)', color: 'var(--danger)' }}>
          <p className="text-sm font-bold">{error}</p>
        </div>
      )}

      {loading && <div className="flex justify-center py-20"><div className="spinner" /></div>}

      {!loading && !error && (
        <>
          <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {paged.map((card) =>
              card.type === 'manual' ? (
                <ReviewCard key={card.key} review={card.data} expanded={expanded.has(card.key)}
                  onToggle={() => toggleExpand(card.key)} formatDate={formatDate} />
              ) : (
                <TweetCard key={card.key} tweet={card.data} expanded={expanded.has(card.key)}
                  onToggle={() => toggleExpand(card.key)} formatDate={formatDate} />
              ),
            )}
            {paged.length === 0 && <div className="col-span-full py-16 text-center" style={{ color: 'var(--muted)' }}>{tx('暂无回顾内容', 'No recaps found')}</div>}
          </section>

          {totalPages > 1 && (
            <section className="flex items-center justify-center gap-2 py-4">
              <button className="btn-outline btn-sm" disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)} style={{ opacity: page <= 1 ? 0.3 : 1 }}>← {tx('上一页', 'Previous')}</button>
              <span className="text-sm font-black" style={{ color: 'var(--muted)' }}>{page} / {totalPages}</span>
              <button className="btn-outline btn-sm" disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)} style={{ opacity: page >= totalPages ? 0.3 : 1 }}>{tx('下一页', 'Next')} →</button>
            </section>
          )}
        </>
      )}
    </div>
  );
}

/* -- 手动回顾卡片 -- */

function ReviewCard({ review: r, expanded, onToggle, formatDate }: {
  review: EventReview;
  expanded: boolean;
  onToggle: () => void;
  formatDate: (s: string | null) => string;
}) {
  const { language, tx } = useLanguage();
  const sc = SOURCE_COLORS[r.source_type] || 'var(--info)';
  const sb = SOURCE_BGS[r.source_type] || 'rgba(120,166,255,0.12)';

  return (
    <div className="event-card"
      style={{ border: '1px solid var(--line)', background: 'var(--panel)', boxShadow: '0 18px 60px rgba(0,0,0,0.22)', padding: '18px' }}>
      <div className="flex items-center justify-between mb-2.5">
        <span className="badge" style={{ borderColor: sc, background: sb, color: sc }}>
          {language === 'zh' ? SOURCE_LABEL[r.source_type] : (r.source_type === 'manual' ? 'Editorial' : 'Twitter')}
        </span>
        <span className="text-xs font-black uppercase tracking-wider" style={{ color: 'var(--muted)' }}>
          {r.published_at ? formatDate(r.published_at) : formatDate(r.created_at)}
        </span>
      </div>
      <h3 className="text-base font-bold leading-snug mb-1.5">
        {r.source_url ? (
          <a href={r.source_url} target="_blank" rel="noopener noreferrer" className="hover:underline">{r.title}</a>
        ) : r.title}
      </h3>
      {r.summary && <p className="mt-1 text-xs leading-relaxed line-clamp-2" style={{ color: 'var(--muted)' }}>{r.summary}</p>}
      {expanded && (
        <div className="mt-3 pt-3" style={{ borderTop: '1px solid var(--line)' }}>
          <p className="text-sm leading-relaxed whitespace-pre-wrap" style={{ color: 'var(--text-dim)' }}>{r.content}</p>
        </div>
      )}
      <div className="mt-3 flex items-center justify-between gap-2 pt-3" style={{ borderTop: '1px solid var(--line)' }}>
        <button onClick={onToggle} className="text-xs font-bold transition hover:brightness-125" style={{ color: 'var(--info)' }}>
          {expanded ? `▲ ${tx('收起', 'Collapse')}` : `▼ ${tx('展开全文', 'Read full text')}`}
        </button>
        {r.source_url && (
          <a href={r.source_url} target="_blank" rel="noopener noreferrer"
            className="btn-outline btn-sm whitespace-nowrap" style={{ minHeight: 36, padding: '0 14px', fontSize: '0.78rem' }}>{tx('来源', 'Source')}</a>
        )}
      </div>
    </div>
  );
}

/* -- 推文回顾卡片（含图片） -- */

function TweetCard({ tweet: t, expanded, onToggle, formatDate }: {
  tweet: TweetReview;
  expanded: boolean;
  onToggle: () => void;
  formatDate: (s: string | null) => string;
}) {
  const { tx } = useLanguage();
  let mediaUrls: string[] = [];
  try {
    mediaUrls = JSON.parse(t.media_urls);
  } catch { mediaUrls = []; }

  return (
    <div className="event-card"
      style={{ border: '1px solid var(--line)', background: 'var(--panel)', boxShadow: '0 18px 60px rgba(0,0,0,0.22)', padding: '18px' }}>
      <div className="flex items-center justify-between mb-2.5">
        <div className="flex items-center gap-2">
          <span className="badge" style={{ borderColor: 'var(--info)', background: 'rgba(120,166,255,0.12)', color: 'var(--info)' }}>
            🐦 Twitter
          </span>
          {t.is_sensitive && (
            <span className="badge" style={{ borderColor: 'var(--warning)', background: 'rgba(248,214,109,0.1)', color: 'var(--warning)' }}>
              {tx('已润色', 'Edited')}
            </span>
          )}
        </div>
        <span className="text-xs font-black uppercase tracking-wider" style={{ color: 'var(--muted)' }}>
          {formatDate(t.published_at || t.created_at)}
        </span>
      </div>

      {t.summary && (
        <h3 className="text-base font-bold leading-snug mb-2">{t.summary}</h3>
      )}

      <p className="text-xs leading-relaxed line-clamp-3 mb-2" style={{ color: 'var(--text-dim)' }}>
        {t.text_processed || t.text}
      </p>

      {mediaUrls.length > 0 && (
        <div className={`grid gap-2 mb-2 ${mediaUrls.length === 1 ? 'grid-cols-1' : 'grid-cols-2'}`}>
          {mediaUrls.map((url, i) => (
            <a key={i} href={t.twitter_url} target="_blank" rel="noopener noreferrer">
              <Image src={url} alt={`${tx('图', 'Image')} ${i + 1}`} width={640} height={360} unoptimized
                className="w-full object-cover" style={{ aspectRatio: '16/9', display: 'block' }} />
            </a>
          ))}
        </div>
      )}

      {expanded && (
        <div className="mt-2 pt-3" style={{ borderTop: '1px solid var(--line)' }}>
          <p className="text-sm leading-relaxed whitespace-pre-wrap" style={{ color: 'var(--text-dim)' }}>
            {t.text_processed || t.text}
          </p>
        </div>
      )}

      <div className="mt-3 flex items-center justify-between gap-2 pt-3" style={{ borderTop: '1px solid var(--line)' }}>
        <button onClick={onToggle} className="text-xs font-bold transition hover:brightness-125" style={{ color: 'var(--info)' }}>
          {expanded ? `▲ ${tx('收起', 'Collapse')}` : `▼ ${tx('展开全文', 'Read full text')}`}
        </button>
        <a href={t.twitter_url} target="_blank" rel="noopener noreferrer"
          className="btn-outline btn-sm whitespace-nowrap" style={{ minHeight: 36, padding: '0 14px', fontSize: '0.78rem' }}>
          🔗 {tx('查看原文', 'View original')}
        </a>
      </div>
    </div>
  );
}
