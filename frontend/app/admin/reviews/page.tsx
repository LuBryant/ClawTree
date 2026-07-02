'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  fetchReviews, createReview, deleteReview,
  fetchTweetReviews,
  type EventReview, type ReviewsFilter,
  type TweetReview, type TweetReviewsFilter,
} from '../../lib/api-client';

const MODE_TABS = [
  { key: 'manual', label: '✍️ 手动回顾' },
  { key: 'tweets', label: '🐦 推文回顾' },
];

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

export default function AdminReviewsPage() {
  // 模式切换
  const [mode, setMode] = useState<'manual' | 'tweets'>('tweets');

  // 手动回顾数据
  const [reviews, setReviews] = useState<EventReview[]>([]);
  const [tweetReviews, setTweetReviews] = useState<TweetReview[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const PS = 12;

  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [expanded, setExpanded] = useState<Set<number>>(new Set());

  // 新增表单
  const [formTitle, setFormTitle] = useState('');
  const [formContent, setFormContent] = useState('');
  const [formUrl, setFormUrl] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // 加载手动回顾
  const loadManual = useCallback(async (f: ReviewsFilter, p: number) => {
    setLoading(true); setError('');
    try {
      const d = await fetchReviews({ ...f, page: p });
      setReviews(d.results); setTotal(d.count);
    } catch {
      setError('无法连接后端 API，请确保 python manage.py runserver 正在运行');
    } finally {
      setLoading(false);
    }
  }, []);

  // 加载推文回顾
  const loadTweets = useCallback(async (f: TweetReviewsFilter, p: number) => {
    setLoading(true); setError('');
    try {
      const d = await fetchTweetReviews({ ...f, page: p });
      setTweetReviews(d.results); setTotal(d.count);
    } catch {
      setError('无法连接后端 API，请确保 python manage.py runserver 正在运行');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (mode === 'manual') {
      const filter: ReviewsFilter = { ordering: '-created_at' };
      if (search) filter.search = search;
      loadManual(filter, page);
    } else {
      const filter: TweetReviewsFilter = { ordering: '-published_at' };
      if (search) filter.search = search;
      loadTweets(filter, page);
    }
  }, [mode, search, page, loadManual, loadTweets]);

  const doSearch = () => { setPage(1); };

  const toggleExpand = (id: number) => setExpanded((p) => {
    const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n;
  });

  const handleDelete = async (id: number) => {
    if (!confirm('确认删除这篇回顾？')) return;
    try {
      await deleteReview(id);
      setReviews((p) => p.filter((r) => r.id !== id));
      setTotal((t) => t - 1);
    } catch {
      alert('删除失败');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formTitle.trim() || !formContent.trim()) return;
    setSubmitting(true);
    try {
      const created = await createReview({
        title: formTitle.trim(),
        content: formContent.trim(),
        source_type: 'manual',
        source_url: formUrl.trim() || undefined,
        published_at: new Date().toISOString(),
      });
      setReviews((p) => [created, ...p]);
      setTotal((t) => t + 1);
      setShowModal(false);
      setFormTitle(''); setFormContent(''); setFormUrl('');
    } catch {
      alert('提交失败，请检查后端是否运行');
    } finally {
      setSubmitting(false);
    }
  };

  const openModal = () => {
    setFormTitle(''); setFormContent(''); setFormUrl('');
    setShowModal(true);
  };

  const switchMode = (m: 'manual' | 'tweets') => { setMode(m); setPage(1); setSearch(''); setExpanded(new Set()); };

  const pages = Math.ceil(total / PS);

  const formatDate = (s: string | null) => {
    if (!s) return '';
    return new Date(s).toLocaleDateString('zh-CN', {
      year: 'numeric', month: '2-digit', day: '2-digit',
    });
  };

  return (
    <div className="flex flex-col gap-6">
      {/* 页头 */}
      <section className="flex items-center justify-between">
        <div>
          <h1 className="font-normal leading-none tracking-tight" style={{ fontSize: 'clamp(1.6rem, 3.5vw, 2.6rem)' }}>活动回顾</h1>
          <p className="mt-1 text-sm" style={{ color: 'var(--muted)' }}>
            AI 分析 + 手动整理的往期活动回顾
            {total > 0 && <span> — 共 <span style={{ color: 'var(--success)', fontWeight: 950 }}>{total}</span> 篇</span>}
          </p>
        </div>
        {mode === 'manual' && <button className="btn btn-success" onClick={openModal}>✍️ 新增回顾</button>}
      </section>

      {/* 模式切换 + 搜索 */}
      <section className="flex flex-wrap items-center gap-3">
        <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && doSearch()}
          placeholder={mode === 'manual' ? '搜索回顾…' : '搜索推文…'} className="input-field w-full sm:w-64" />
        <button className="btn btn-success btn-sm" onClick={doSearch}>搜索</button>
      </section>

      {/* 模式标签 */}
      <section className="flex gap-2">
        {MODE_TABS.map((t) => (
          <button key={t.key} onClick={() => switchMode(t.key as 'manual' | 'tweets')}
            className={`btn btn-sm ${mode === t.key ? 'btn-warning' : 'btn-outline'}`}>
            {t.label}
          </button>
        ))}
      </section>

      {/* 错误 */}
      {error && (
        <div className="text-center py-8" style={{ border: '1px solid rgba(255,61,87,0.42)', background: 'rgba(255,61,87,0.08)', color: 'var(--danger)' }}>
          <p className="text-sm font-bold">{error}</p>
        </div>
      )}

      {/* 加载 */}
      {loading && <div className="flex justify-center py-20"><div className="spinner" /></div>}

      {/* 手动回顾列表 */}
      {!loading && !error && mode === 'manual' && (
        <>
          <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {reviews.map((r) => (
              <ReviewCard key={r.id} review={r} expanded={expanded.has(r.id)}
                onToggle={() => toggleExpand(r.id)} onDelete={() => handleDelete(r.id)}
                formatDate={formatDate} />
            ))}
            {reviews.length === 0 && <div className="col-span-full py-16 text-center" style={{ color: 'var(--muted)' }}>暂无回顾文章</div>}
          </section>
          {pages > 1 && <Pagination page={page} pages={pages} setPage={setPage} />}
        </>
      )}

      {/* 推文回顾列表 */}
      {!loading && !error && mode === 'tweets' && (
        <>
          <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {tweetReviews.map((t) => (
              <TweetCard key={t.id} tweet={t} expanded={expanded.has(t.id)}
                onToggle={() => toggleExpand(t.id)} formatDate={formatDate} />
            ))}
            {tweetReviews.length === 0 && <div className="col-span-full py-16 text-center" style={{ color: 'var(--muted)' }}>暂无推文回顾</div>}
          </section>
          {pages > 1 && <Pagination page={page} pages={pages} setPage={setPage} />}
        </>
      )}

      {/* 新增弹窗 */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center modal-backdrop">
          <div className="mx-4 w-full max-w-2xl max-h-[90vh] overflow-y-auto"
            style={{ border: '1px solid rgba(22,242,179,0.2)', background: 'linear-gradient(135deg, rgba(22,242,179,0.06), rgba(120,166,255,0.04) 50%, rgba(248,214,109,0.06)), #081118', boxShadow: '0 24px 80px rgba(0,0,0,0.55)', padding: '24px' }}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-black uppercase tracking-wider">✍️ 新增回顾文章</h2>
              <button onClick={() => setShowModal(false)} className="text-xl leading-none" style={{ color: 'var(--muted)' }}>✕</button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="mb-3">
                <label className="block text-xs font-black uppercase tracking-wider mb-1" style={{ color: 'var(--muted)' }}>标题 *</label>
                <input type="text" value={formTitle} onChange={(e) => setFormTitle(e.target.value)}
                  placeholder="回顾文章标题" className="input-field w-full" required />
              </div>
              <div className="mb-3">
                <label className="block text-xs font-black uppercase tracking-wider mb-1" style={{ color: 'var(--muted)' }}>正文 *</label>
                <textarea value={formContent} onChange={(e) => setFormContent(e.target.value)}
                  placeholder="正文内容（支持换行）..." rows={10}
                  className="input-field w-full resize-y mono text-xs leading-relaxed" required />
              </div>
              <div className="mb-4">
                <label className="block text-xs font-black uppercase tracking-wider mb-1" style={{ color: 'var(--muted)' }}>参考链接（可选）</label>
                <input type="url" value={formUrl} onChange={(e) => setFormUrl(e.target.value)}
                  placeholder="https://..." className="input-field w-full" />
              </div>
              <div className="flex gap-3 justify-end">
                <button type="button" className="btn-outline btn-sm" onClick={() => setShowModal(false)}>取消</button>
                <button type="submit" className="btn btn-success btn-sm" disabled={submitting}>
                  {submitting ? '提交中...' : '提交'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */

function Pagination({ page, pages, setPage }: { page: number; pages: number; setPage: (f: (p: number) => number) => void }) {
  return (
    <section className="flex items-center justify-center gap-2 py-4">
      <button className="btn-outline btn-sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)} style={{ opacity: page <= 1 ? 0.3 : 1 }}>← 上一页</button>
      <span className="text-sm font-black" style={{ color: 'var(--muted)' }}>{page} / {pages}</span>
      <button className="btn-outline btn-sm" disabled={page >= pages} onClick={() => setPage((p) => p + 1)} style={{ opacity: page >= pages ? 0.3 : 1 }}>下一页 →</button>
    </section>
  );
}

/* -- 手动回顾卡片 -- */

function ReviewCard({ review: r, expanded, onToggle, onDelete, formatDate }: {
  review: EventReview;
  expanded: boolean;
  onToggle: () => void;
  onDelete: () => void;
  formatDate: (s: string | null) => string;
}) {
  const sc = SOURCE_COLORS[r.source_type] || 'var(--info)';
  const sb = SOURCE_BGS[r.source_type] || 'rgba(120,166,255,0.12)';

  return (
    <div className="event-card"
      style={{ border: '1px solid var(--line)', background: 'var(--panel)', boxShadow: '0 18px 60px rgba(0,0,0,0.22)', padding: '18px' }}>
      <div className="flex items-center justify-between mb-2.5">
        <span className="badge" style={{ borderColor: sc, background: sb, color: sc }}>
          {SOURCE_LABEL[r.source_type]}
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
          {expanded ? '▲ 收起' : '▼ 展开全文'}
        </button>
        <div className="flex gap-2">
          {r.source_url && (
            <a href={r.source_url} target="_blank" rel="noopener noreferrer"
              className="btn-outline btn-sm whitespace-nowrap" style={{ minHeight: 36, padding: '0 14px', fontSize: '0.78rem' }}>来源</a>
          )}
          {r.source_type === 'manual' && (
            <button onClick={onDelete} className="btn btn-danger btn-sm whitespace-nowrap"
              style={{ minHeight: 36, padding: '0 14px', fontSize: '0.78rem' }}>🗑 删除</button>
          )}
        </div>
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
  // 解析 media_urls JSON
  let mediaUrls: string[] = [];
  try {
    mediaUrls = JSON.parse(t.media_urls);
  } catch { mediaUrls = []; }

  return (
    <div className="event-card"
      style={{ border: '1px solid var(--line)', background: 'var(--panel)', boxShadow: '0 18px 60px rgba(0,0,0,0.22)', padding: '18px' }}>
      {/* 顶部：来源徽章 + 时间 */}
      <div className="flex items-center justify-between mb-2.5">
        <div className="flex items-center gap-2">
          <span className="badge" style={{ borderColor: 'var(--info)', background: 'rgba(120,166,255,0.12)', color: 'var(--info)' }}>
            🐦 Twitter
          </span>
          {t.is_sensitive && (
            <span className="badge" style={{ borderColor: 'var(--warning)', background: 'rgba(248,214,109,0.1)', color: 'var(--warning)' }}>
              已润色
            </span>
          )}
        </div>
        <span className="text-xs font-black uppercase tracking-wider" style={{ color: 'var(--muted)' }}>
          {formatDate(t.published_at || t.created_at)}
        </span>
      </div>

      {/* AI 摘要 */}
      {t.summary && (
        <h3 className="text-base font-bold leading-snug mb-2">{t.summary}</h3>
      )}

      {/* 文案 */}
      <p className="text-xs leading-relaxed line-clamp-3 mb-2" style={{ color: 'var(--text-dim)' }}>
        {t.text_processed || t.text}
      </p>

      {/* 图片网格 */}
      {mediaUrls.length > 0 && (
        <div className={`grid gap-2 mb-2 ${mediaUrls.length === 1 ? 'grid-cols-1' : 'grid-cols-2'}`}>
          {mediaUrls.map((url, i) => (
            <a key={i} href={t.twitter_url} target="_blank" rel="noopener noreferrer">
              <img src={url} alt={`图 ${i + 1}`} loading="lazy"
                className="w-full object-cover" style={{ aspectRatio: '16/9', display: 'block' }} />
            </a>
          ))}
        </div>
      )}

      {/* 展开全文 */}
      {expanded && (
        <div className="mt-2 pt-3" style={{ borderTop: '1px solid var(--line)' }}>
          <p className="text-sm leading-relaxed whitespace-pre-wrap" style={{ color: 'var(--text-dim)' }}>
            {t.text_processed || t.text}
          </p>
        </div>
      )}

      {/* 底部操作栏 */}
      <div className="mt-3 flex items-center justify-between gap-2 pt-3" style={{ borderTop: '1px solid var(--line)' }}>
        <button onClick={onToggle} className="text-xs font-bold transition hover:brightness-125" style={{ color: 'var(--info)' }}>
          {expanded ? '▲ 收起' : '▼ 展开全文'}
        </button>
        <a href={t.twitter_url} target="_blank" rel="noopener noreferrer"
          className="btn-outline btn-sm whitespace-nowrap" style={{ minHeight: 36, padding: '0 14px', fontSize: '0.78rem' }}>
          🔗 查看原文
        </a>
      </div>
    </div>
  );
}
