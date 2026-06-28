'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  fetchEvents,
  fetchEventStats,
  type UniversityEvent,
  type EventStats,
  type EventsFilter,
} from '../../lib/api-client';

// ---------------------------------------------------------------------------
// 筛选选项
// ---------------------------------------------------------------------------

const CATEGORIES = ['', 'AI', 'Web3', 'AI+Web3'] as const;
const EVENT_TYPES = ['', '讲座', '黑客松', '论坛', '工作坊', '其他'] as const;
const CATEGORY_LABELS: Record<string, string> = {
  '': '全部分类',
  AI: '🤖 AI',
  Web3: '⛓️ Web3',
  'AI+Web3': '⚡ AI+Web3',
};
const TYPE_LABELS: Record<string, string> = {
  '': '全部类型',
  '讲座': '🎙️ 讲座',
  '黑客松': '💻 黑客松',
  '论坛': '🎤 论坛',
  '工作坊': '🔧 工作坊',
  '其他': '📌 其他',
};

// ---------------------------------------------------------------------------
// 页面
// ---------------------------------------------------------------------------

export default function AdminEventsPage() {
  const [events, setEvents] = useState<UniversityEvent[]>([]);
  const [stats, setStats] = useState<EventStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const pageSize = 12;

  const [filter, setFilter] = useState<EventsFilter>({
    category: '',
    event_type: '',
    ordering: '-created_at',
  });
  const [searchInput, setSearchInput] = useState('');

  const loadEvents = useCallback(async (f: EventsFilter, p: number) => {
    setLoading(true);
    setError('');
    try {
      const [data, statsData] = await Promise.all([
        fetchEvents({ ...f, page: p }),
        fetchEventStats(),
      ]);
      setEvents(data.results);
      setTotal(data.count);
      setStats(statsData);
    } catch {
      setError('无法连接后端 API，请确保 python manage.py runserver 正在运行');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadEvents(filter, page);
  }, [filter, page, loadEvents]);

  const handleSearch = () => {
    setFilter((f) => ({ ...f, search: searchInput }));
    setPage(1);
  };

  const totalPages = Math.ceil(total / pageSize);

  return (
    <div className="flex flex-col gap-6">
      {/* 页头 */}
      <section>
        <h1 className="text-3xl font-bold tracking-tight">活动浏览器</h1>
        <p className="mt-1 text-sm text-zinc-500">
          AI Agent 自动采集的高校 AI/Web3 活动
          {stats ? (
            <span>
              {' '}— 共 <span className="text-emerald-400 font-semibold">{stats.total}</span> 条，
              已联系 <span className="text-emerald-400 font-semibold">{stats.contacted}</span> 条
            </span>
          ) : null}
        </p>
      </section>

      {/* 筛选栏 */}
      <section className="flex flex-wrap items-center gap-3">
        <input
          type="text"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
          placeholder="搜索标题、高校…"
          className="w-full sm:w-64 rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-2 text-sm text-zinc-200 placeholder-zinc-500 outline-none focus:border-emerald-500 transition"
        />
        <button
          onClick={handleSearch}
          className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500 transition"
        >
          搜索
        </button>

        <select
          value={filter.category || ''}
          onChange={(e) => { setFilter((f) => ({ ...f, category: e.target.value })); setPage(1); }}
          className="rounded-xl border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-300 outline-none focus:border-emerald-500 transition"
        >
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>{CATEGORY_LABELS[c]}</option>
          ))}
        </select>

        <select
          value={filter.event_type || ''}
          onChange={(e) => { setFilter((f) => ({ ...f, event_type: e.target.value })); setPage(1); }}
          className="rounded-xl border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-300 outline-none focus:border-emerald-500 transition"
        >
          {EVENT_TYPES.map((t) => (
            <option key={t} value={t}>{TYPE_LABELS[t]}</option>
          ))}
        </select>

        <select
          value={filter.ordering || '-created_at'}
          onChange={(e) => { setFilter((f) => ({ ...f, ordering: e.target.value })); setPage(1); }}
          className="rounded-xl border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-300 outline-none focus:border-emerald-500 transition"
        >
          <option value="-created_at">最新收录</option>
          <option value="-score">评分最高</option>
          <option value="event_date">活动日期 ↑</option>
          <option value="-event_date">活动日期 ↓</option>
        </select>
      </section>

      {/* 错误提示 */}
      {error && (
        <div className="rounded-2xl border border-red-800 bg-red-950/40 p-6 text-center">
          <p className="text-red-400 text-sm">{error}</p>
        </div>
      )}

      {/* 加载中 */}
      {loading && (
        <div className="flex justify-center py-20">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-zinc-700 border-t-emerald-400" />
        </div>
      )}

      {/* 活动列表 */}
      {!loading && !error && (
        <>
          <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {events.map((event) => (
              <EventCard key={event.id} event={event} />
            ))}
            {events.length === 0 && (
              <div className="col-span-full py-16 text-center text-zinc-500">
                暂无匹配的活动数据
              </div>
            )}
          </section>

          {totalPages > 1 && (
            <section className="flex items-center justify-center gap-2 py-4">
              <button
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
                className="rounded-xl border border-zinc-700 px-3 py-1.5 text-sm text-zinc-400 hover:border-zinc-500 disabled:opacity-30 transition"
              >
                ← 上一页
              </button>
              <span className="text-sm text-zinc-500">{page} / {totalPages}</span>
              <button
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
                className="rounded-xl border border-zinc-700 px-3 py-1.5 text-sm text-zinc-400 hover:border-zinc-500 disabled:opacity-30 transition"
              >
                下一页 →
              </button>
            </section>
          )}
        </>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// 卡片子组件
// ---------------------------------------------------------------------------

function EventCard({ event }: { event: UniversityEvent }) {
  const dateStr = event.event_date || '日期待定';
  const endStr = event.event_end_date ? ` → ${event.event_end_date}` : '';

  return (
    <div className="group rounded-2xl border border-zinc-800 bg-zinc-900/60 p-5 transition hover:border-zinc-700 hover:bg-zinc-900">
      {/* 分类 + 评分 */}
      <div className="flex items-center justify-between mb-2">
        <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${
          event.category === 'AI' ? 'bg-blue-950 text-blue-400' :
          event.category === 'Web3' ? 'bg-orange-950 text-orange-400' :
          'bg-purple-950 text-purple-400'
        }`}>
          {event.category}
        </span>
        <div className="flex items-center gap-2">
          <span className="text-xs text-zinc-600">{event.event_type}</span>
          {event.score > 0 && (
            <span className="rounded-full bg-emerald-950 px-2 py-0.5 text-xs font-semibold text-emerald-400">
              {event.score}分
            </span>
          )}
        </div>
      </div>

      <h3 className="text-base font-semibold leading-snug group-hover:text-emerald-400 transition">
        <a href={event.source_url} target="_blank" rel="noopener noreferrer">
          {event.title}
        </a>
      </h3>

      <p className="mt-1.5 text-sm text-zinc-400">
        🏫 {event.university || '未知高校'}
      </p>
      <p className="text-xs text-zinc-500">
        📅 {dateStr}{endStr}
        {event.location ? ` · 📍 ${event.location}` : ''}
      </p>

      {event.description && (
        <p className="mt-2 text-xs leading-relaxed text-zinc-600 line-clamp-2">
          {event.description}
        </p>
      )}

      <div className="mt-3 flex items-center justify-between border-t border-zinc-800 pt-3">
        <div className="flex flex-col gap-0.5 text-xs">
          {event.contact_email ? (
            <a
              href={`mailto:${event.contact_email}`}
              className="text-emerald-500 hover:underline truncate max-w-[200px]"
            >
              ✉️ {event.contact_email}
            </a>
          ) : (
            <span className="text-zinc-600">✉️ 无联系方式</span>
          )}
          {event.contact_phone && (
            <span className="text-zinc-500">📞 {event.contact_phone}</span>
          )}
        </div>

        <div className="flex gap-2">
          {event.registration_url && (
            <a
              href={event.registration_url}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-lg bg-emerald-700 px-3 py-1 text-xs font-medium text-white hover:bg-emerald-600 transition"
            >
              报名
            </a>
          )}
          <a
            href={event.source_url}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-lg border border-zinc-700 px-3 py-1 text-xs text-zinc-400 hover:border-zinc-500 hover:text-zinc-200 transition"
          >
            来源
          </a>
        </div>
      </div>
    </div>
  );
}
