'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  fetchEvents, fetchEventStats,
  type UniversityEvent, type EventStats, type EventsFilter,
} from '../../lib/api-client';
import { useLanguage } from '../../i18n/LanguageProvider';

const CATEGORIES = ['', 'AI', 'Web3', 'AI+Web3'] as const;
const EVENT_TYPES = ['', '黑客松', '分享会', '讲座', '竞赛', '研讨会', '论坛', '工作坊', '其他'] as const;
const CAT_LABEL: Record<string, string> = { '': '全部分类', AI: '🤖 AI', Web3: '⛓️ Web3', 'AI+Web3': '⚡ AI+Web3' };
const TYPE_LABEL: Record<string, string> = { '': '全部类型', '黑客松': '💻 黑客松', '分享会': '🎯 分享会', '讲座': '🎙️ 讲座', '竞赛': '🏆 竞赛', '研讨会': '🎓 研讨会', '论坛': '🎤 论坛', '工作坊': '🔧 工作坊', '其他': '📌 其他' };
const TYPE_LABEL_EN: Record<string, string> = { '': 'All types', '黑客松': '💻 Hackathon', '分享会': '🎯 Meetup', '讲座': '🎙️ Lecture', '竞赛': '🏆 Competition', '研讨会': '🎓 Seminar', '论坛': '🎤 Forum', '工作坊': '🔧 Workshop', '其他': '📌 Other' };

const PS = 12;

export default function UserEventsPage() {
  const { language, tx } = useLanguage();
  const [events, setEvents] = useState<UniversityEvent[]>([]);
  const [stats, setStats] = useState<EventStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);

  const [filter, setFilter] = useState<EventsFilter>({ category: '', event_type: '', ordering: '-event_date' });
  const [search, setSearch] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [aiReasoning, setAiReasoning] = useState('');

  const load = useCallback(async (f: EventsFilter, p: number) => {
    setLoading(true); setError('');
    try {
      const [d, s] = await Promise.all([
        fetchEvents({ ...f, page: p }),
        fetchEventStats(),
      ]);
      setEvents(d.results); setTotal(d.count); setStats(s);
    } catch {
      setError(tx('无法连接后端 API，请确保服务正在运行', 'Unable to reach the backend API. Please ensure the service is running.'));
    } finally {
      setLoading(false);
    }
  }, [tx]);

  useEffect(() => {
    const timer = window.setTimeout(() => { void load(filter, page); }, 0);
    return () => window.clearTimeout(timer);
  }, [filter, page, load]);

  const doSearch = () => { setFilter((f) => ({ ...f, search })); setPage(1); };

  const onAiFilter = async () => {
    const q = search.trim();
    if (!q) return;
    setAiLoading(true); setAiReasoning('');
    try {
      const res = await fetch('/api/events/ai-filter', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: q }),
      });
      const data = await res.json();
      if (res.ok && data.filter) {
        setFilter((f) => ({ ...f, ...data.filter }));
        setPage(1);
        setAiReasoning(data.reasoning || '');
      } else {
        setAiReasoning(data.message || tx('AI 解析失败，请稍后重试', 'AI parsing failed, please try again later'));
      }
    } catch {
      setAiReasoning(tx('AI 服务不可用，请稍后重试', 'AI service unavailable, please try again later'));
    } finally {
      setAiLoading(false);
    }
  };

  const pages = Math.ceil(total / PS);

  return (
    <div className="flex flex-col gap-6">
      <section className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <h2 className="text-3xl font-black tracking-tight">{tx('近期高校活动', 'Upcoming Campus Events')}</h2>
          <p className="mt-2 text-sm" style={{ color: 'var(--muted)' }}>
            {tx('AI Agent 自动采集的高校 AI/Web3 活动', 'Campus AI/Web3 events collected by the AI Agent')}
            {stats && <span> — <span style={{ color: 'var(--success)', fontWeight: 950 }}>{stats.total}</span> {tx('条', 'events')}</span>}
          </p>
        </div>
        <span className="badge badge-success">{tx('公开端 · 联系信息仅管理端可见', 'Public portal · Contact details restricted to operations')}</span>
      </section>

      {/* 筛选栏 */}
      <section className="flex flex-wrap items-center gap-3">
        <input type="text" value={search} onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && doSearch()}
          placeholder={tx('搜索标题、高校…', 'Search titles or universities…')} className="input-field w-full sm:w-64" />
        <button className="btn btn-success btn-sm" onClick={doSearch}>{tx('搜索', 'Search')}</button>
        <button className="btn btn-ai btn-sm" onClick={onAiFilter} disabled={aiLoading}>
          {aiLoading ? tx('🤖 AI 解析中…', '🤖 AI parsing…') : tx('🤖 AI 识别', '🤖 AI Filter')}
        </button>
        <select value={filter.category || ''} onChange={(e) => { setFilter((f) => ({ ...f, category: e.target.value })); setPage(1); }} className="select-field">
          {CATEGORIES.map((c) => (<option key={c} value={c}>{c === '' ? tx('全部分类', 'All categories') : CAT_LABEL[c]}</option>))}
        </select>
        <select value={filter.event_type || ''} onChange={(e) => { setFilter((f) => ({ ...f, event_type: e.target.value })); setPage(1); }} className="select-field">
          {EVENT_TYPES.map((t) => (<option key={t} value={t}>{language === 'zh' ? TYPE_LABEL[t] : TYPE_LABEL_EN[t]}</option>))}
        </select>
        <select value={filter.ordering || '-event_date'} onChange={(e) => { setFilter((f) => ({ ...f, ordering: e.target.value })); setPage(1); }} className="select-field">
          <option value="-event_date">{tx('活动日期', 'Event date')} ↓</option>
          <option value="event_date">{tx('活动日期', 'Event date')} ↑</option>
          <option value="-created_at">{tx('最新收录', 'Recently added')}</option>
        </select>
      </section>

      {aiReasoning && (
        <section style={{ border: '1px solid rgba(167,139,250,0.38)', background: 'rgba(167,139,250,0.06)', padding: '10px 16px' }}>
          <p className="text-sm font-bold" style={{ color: '#a78bfa' }}>🤖 {aiReasoning}</p>
        </section>
      )}

      {error && (
        <div className="text-center py-8" style={{ border: '1px solid rgba(255,61,87,0.42)', background: 'rgba(255,61,87,0.08)', color: 'var(--danger)' }}>
          <p className="text-sm font-bold">{error}</p>
        </div>
      )}

      {loading && <div className="flex justify-center py-20"><div className="spinner" /></div>}

      {!loading && !error && (
        <>
          <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {events.map((e) => (
              <EventCard key={e.id} event={e} />
            ))}
            {events.length === 0 && <div className="col-span-full py-16 text-center" style={{ color: 'var(--muted)' }}>{tx('暂无匹配数据', 'No matching events')}</div>}
          </section>
          {pages > 1 && (
            <section className="flex items-center justify-center gap-2 py-4">
              <button className="btn-outline btn-sm" disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)} style={{ opacity: page <= 1 ? 0.3 : 1 }}>← {tx('上一页', 'Previous')}</button>
              <span className="text-sm font-black" style={{ color: 'var(--muted)' }}>{page} / {pages}</span>
              <button className="btn-outline btn-sm" disabled={page >= pages}
                onClick={() => setPage((p) => p + 1)} style={{ opacity: page >= pages ? 0.3 : 1 }}>{tx('下一页', 'Next')} →</button>
            </section>
          )}
        </>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */

function EventCard({ event: e }: { event: UniversityEvent }) {
  const { tx } = useLanguage();
  const dateStr = e.event_date || tx('日期待定', 'Date TBD');
  const endStr = e.event_end_date ? ` → ${e.event_end_date}` : '';
  const catColors: Record<string, string> = { AI: 'var(--info)', Web3: 'var(--warning)', 'AI+Web3': 'var(--danger)' };
  const catBgs: Record<string, string> = { AI: 'rgba(120,166,255,0.12)', Web3: 'rgba(248,214,109,0.1)', 'AI+Web3': 'rgba(255,61,87,0.1)' };
  const cc = catColors[e.category] || 'var(--info)';
  const cb = catBgs[e.category] || 'rgba(120,166,255,0.12)';

  return (
    <div className="event-card"
      style={{ border: '1px solid var(--line)', background: 'var(--panel)', boxShadow: '0 18px 60px rgba(0,0,0,0.22)', padding: '18px' }}>
      <div className="flex items-center justify-between mb-2.5">
        <span className="badge" style={{ borderColor: cc, background: cb, color: cc }}>{e.category}</span>
        <div className="flex items-center gap-2">
          <span className="text-xs font-black uppercase tracking-wider" style={{ color: 'var(--muted)' }}>{e.event_type}</span>
          {e.score > 0 && <span className="badge badge-success" style={{ fontSize: '0.68rem' }}>{e.score}P</span>}
        </div>
      </div>
      <h3 className="text-base font-bold leading-snug mb-1.5">
        {e.source_url ? (
          <a href={e.source_url} target="_blank" rel="noopener noreferrer" className="hover:underline">{e.title}</a>
        ) : e.title}
      </h3>
      <p className="text-sm mt-1" style={{ color: 'var(--text-dim)' }}>🏫 {e.university || tx('未知高校', 'University pending')}</p>
      <p className="text-xs mt-0.5" style={{ color: 'var(--muted)' }}>📅 {dateStr}{endStr}{e.location ? ` · 📍 ${e.location}` : ''}</p>
      {e.description && <p className="mt-2.5 text-xs leading-relaxed line-clamp-2" style={{ color: 'var(--muted)' }}>{e.description}</p>}
      <div className="mt-3 flex items-center gap-2 pt-3" style={{ borderTop: '1px solid var(--line)' }}>
        {e.registration_url ? (
          <a href={e.registration_url} target="_blank" rel="noopener noreferrer"
            className="btn btn-success btn-sm whitespace-nowrap">📝 {tx('报名/详情入口', 'Register / details')}</a>
        ) : e.source_url ? (
          <a href={e.source_url} target="_blank" rel="noopener noreferrer"
            className="btn btn-success btn-sm whitespace-nowrap">🔗 {tx('查看详情', 'View details')}</a>
        ) : (
          <span className="btn-outline btn-sm whitespace-nowrap" style={{ opacity: 0.5 }}>{tx('暂无详情入口', 'No details link')}</span>
        )}
        <span className="text-xs font-bold ml-auto" style={{ color: 'var(--muted)' }}>{tx('联系信息仅管理端', 'Contacts restricted')}</span>
      </div>
    </div>
  );
}
