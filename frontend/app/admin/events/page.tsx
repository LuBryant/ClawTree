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
  '': '全部分类', AI: '🤖 AI', Web3: '⛓️ Web3', 'AI+Web3': '⚡ AI+Web3',
};
const TYPE_LABELS: Record<string, string> = {
  '': '全部类型', '讲座': '🎙️ 讲座', '黑客松': '💻 黑客松', '论坛': '🎤 论坛', '工作坊': '🔧 工作坊', '其他': '📌 其他',
};

// ---------------------------------------------------------------------------
// 默认邮件模板
// ---------------------------------------------------------------------------

const DEFAULT_MAIL_TEMPLATE = `尊敬的 {高校名称} 老师：

您好！我是大树财经的 {你的名字}。

我们注意到贵校即将举办「{活动标题}」，活动内容与大树财经关注的 AI/Web3 高校生态高度契合。

大树财经是 Web3+AI 领域的媒体与活动品牌，正推动全球高校行计划，已成功支持多场黑客松和学术论坛。我们希望能与贵校探讨以下合作方向：

1. 联合举办 AI/Web3 主题活动（线上/线下/混合）
2. 嘉宾分享与技术资源支持
3. 学生实习与人才对接

期待与您进一步沟通！

此致
敬礼

大树财经团队
联系方式：{你的邮箱}`;

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

  const [filter, setFilter] = useState<EventsFilter>({ category: '', event_type: '', ordering: '-created_at' });
  const [searchInput, setSearchInput] = useState('');

  // 批量选择
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());

  // 邮件模板
  const [showMailModal, setShowMailModal] = useState(false);
  const [mailTemplate, setMailTemplate] = useState(DEFAULT_MAIL_TEMPLATE);
  const [mailSenderName, setMailSenderName] = useState('');
  const [mailSenderEmail, setMailSenderEmail] = useState('');

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

  useEffect(() => { setSelectedIds(new Set()); }, [page, filter]);

  const handleSearch = () => {
    setFilter((f) => ({ ...f, search: searchInput }));
    setPage(1);
  };

  // 选择逻辑
  const toggleSelect = (id: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const selectAll = () => {
    if (selectedIds.size === events.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(events.map((e) => e.id)));
    }
  };

  const selectedEvents = events.filter((e) => selectedIds.has(e.id));

  // 构建邮件
  const buildMail = (event: UniversityEvent) => {
    return mailTemplate
      .replace(/\{高校名称\}/g, event.university || '贵校')
      .replace(/\{活动标题\}/g, event.title)
      .replace(/\{你的名字\}/g, mailSenderName || '[你的名字]')
      .replace(/\{你的邮箱\}/g, mailSenderEmail || '[你的邮箱]');
  };

  const handleSendMail = (event: UniversityEvent) => {
    const body = buildMail(event);
    const subject = `大树财经 · 高校合作邀请 — ${event.title}`;
    window.open(
      `https://mail.google.com/mail/?view=cm&fs=1&to=${event.contact_email}&su=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`,
      '_blank'
    );
  };

  const handleBatchSend = () => {
    const eventsWithEmail = selectedEvents.filter((e) => e.contact_email);
    if (eventsWithEmail.length === 0) {
      alert('所选活动中没有可用的联系邮箱');
      return;
    }
    const emails = eventsWithEmail.map((e) => e.contact_email).join(',');
    // 每封邮件使用模板生成、分隔线隔开
    const body = eventsWithEmail
      .map((e, i) => {
        const content = buildMail(e);
        return eventsWithEmail.length > 1
          ? `--- 第 ${i + 1} 封：${e.university} — ${e.title} ---\n${content}`
          : content;
      })
      .join('\n\n');
    const subject = `大树财经 · 高校合作邀请 — ${eventsWithEmail[0].title}${eventsWithEmail.length > 1 ? ` 等 ${eventsWithEmail.length} 项` : ''}`;
    window.open(
      `https://mail.google.com/mail/?view=cm&fs=1&bcc=${emails}&su=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`,
      '_blank'
    );
  };

  const totalPages = Math.ceil(total / pageSize);

  return (
    <div className="flex flex-col gap-6">
      {/* 页头 */}
      <section className="flex items-center justify-between">
        <div>
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
        </div>
        <button
          onClick={() => setShowMailModal(true)}
          className="flex items-center gap-2 rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-2.5 text-sm text-zinc-300 hover:border-amber-600 hover:text-amber-400 transition"
        >
          📧 邮件模板
        </button>
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
          {CATEGORIES.map((c) => (<option key={c} value={c}>{CATEGORY_LABELS[c]}</option>))}
        </select>

        <select
          value={filter.event_type || ''}
          onChange={(e) => { setFilter((f) => ({ ...f, event_type: e.target.value })); setPage(1); }}
          className="rounded-xl border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-300 outline-none focus:border-emerald-500 transition"
        >
          {EVENT_TYPES.map((t) => (<option key={t} value={t}>{TYPE_LABELS[t]}</option>))}
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

      {/* 批量操作栏 */}
      {selectedIds.size > 0 && (
        <section className="flex items-center gap-4 rounded-2xl border border-amber-800 bg-amber-950/30 px-5 py-3">
          <span className="text-sm text-amber-400 font-medium">
            已选 {selectedIds.size} 项
          </span>
          <button
            onClick={handleBatchSend}
            className="rounded-xl bg-amber-600 px-4 py-2 text-sm font-medium text-white hover:bg-amber-500 transition"
          >
            📧 批量发送邮件
          </button>
          <button
            onClick={() => setSelectedIds(new Set())}
            className="rounded-xl border border-zinc-600 px-3 py-1.5 text-sm text-zinc-400 hover:text-zinc-200 transition"
          >
            取消选择
          </button>
        </section>
      )}

      {/* 全选栏 */}
      {!loading && !error && events.length > 0 && (
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-sm text-zinc-500 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={selectedIds.size === events.length && events.length > 0}
              onChange={selectAll}
              className="rounded border-zinc-600 bg-zinc-900 text-emerald-500 focus:ring-emerald-500"
            />
            全选本页
          </label>
        </div>
      )}

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
              <EventCard
                key={event.id}
                event={event}
                selected={selectedIds.has(event.id)}
                onToggle={() => toggleSelect(event.id)}
                onSendMail={() => handleSendMail(event)}
              />
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

      {/* 邮件模板弹窗 */}
      {showMailModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
          <div className="mx-4 w-full max-w-2xl rounded-2xl border border-zinc-700 bg-zinc-900 p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold">📧 邮件模板配置</h2>
              <button
                onClick={() => setShowMailModal(false)}
                className="text-zinc-500 hover:text-zinc-200 text-xl leading-none transition"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-zinc-500 mb-4">
              使用 <code className="text-amber-400">{'{高校名称}'}</code>{' '}
              <code className="text-amber-400">{'{活动标题}'}</code>{' '}
              <code className="text-amber-400">{'{你的名字}'}</code>{' '}
              <code className="text-amber-400">{'{你的邮箱}'}</code>{' '}
              作为占位变量，发送时自动替换。
            </p>

            {/* 发件人信息 */}
            <div className="grid grid-cols-2 gap-3 mb-4">
              <div>
                <label className="block text-xs text-zinc-500 mb-1">你的名字</label>
                <input
                  type="text"
                  value={mailSenderName}
                  onChange={(e) => setMailSenderName(e.target.value)}
                  placeholder="张三"
                  className="w-full rounded-xl border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-200 outline-none focus:border-amber-500 transition"
                />
              </div>
              <div>
                <label className="block text-xs text-zinc-500 mb-1">你的邮箱</label>
                <input
                  type="email"
                  value={mailSenderEmail}
                  onChange={(e) => setMailSenderEmail(e.target.value)}
                  placeholder="zhangsan@treefinance.com"
                  className="w-full rounded-xl border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-200 outline-none focus:border-amber-500 transition"
                />
              </div>
            </div>

            {/* 模板内容 */}
            <label className="block text-xs text-zinc-500 mb-1">邮件正文</label>
            <textarea
              value={mailTemplate}
              onChange={(e) => setMailTemplate(e.target.value)}
              rows={14}
              className="w-full rounded-xl border border-zinc-700 bg-zinc-800 px-4 py-3 text-sm text-zinc-200 outline-none focus:border-amber-500 transition font-mono resize-y"
            />

            <div className="flex gap-3 mt-4 justify-end">
              <button
                onClick={() => {
                  setMailTemplate(DEFAULT_MAIL_TEMPLATE);
                  setMailSenderName('');
                  setMailSenderEmail('');
                }}
                className="rounded-xl border border-zinc-600 px-4 py-2 text-sm text-zinc-400 hover:text-zinc-200 transition"
              >
                恢复默认
              </button>
              <button
                onClick={() => setShowMailModal(false)}
                className="rounded-xl bg-emerald-600 px-5 py-2 text-sm font-medium text-white hover:bg-emerald-500 transition"
              >
                保存模板
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// 卡片子组件
// ---------------------------------------------------------------------------

function EventCard({
  event,
  selected,
  onToggle,
  onSendMail,
}: {
  event: UniversityEvent;
  selected: boolean;
  onToggle: () => void;
  onSendMail: () => void;
}) {
  const dateStr = event.event_date || '日期待定';
  const endStr = event.event_end_date ? ` → ${event.event_end_date}` : '';

  return (
    <div
      className={`group rounded-2xl border p-5 transition ${
        selected
          ? 'border-amber-700 bg-amber-950/20'
          : 'border-zinc-800 bg-zinc-900/60 hover:border-zinc-700 hover:bg-zinc-900'
      }`}
    >
      {/* 选择框 + 分类 + 评分 */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={selected}
            onChange={onToggle}
            className="rounded border-zinc-600 bg-zinc-900 text-emerald-500 focus:ring-emerald-500"
          />
          <span
            className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${
              event.category === 'AI'
                ? 'bg-blue-950 text-blue-400'
                : event.category === 'Web3'
                  ? 'bg-orange-950 text-orange-400'
                  : 'bg-purple-950 text-purple-400'
            }`}
          >
            {event.category}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-zinc-600">{event.event_type}</span>
          {event.score > 0 && (
            <span className="rounded-full bg-emerald-950 px-2 py-0.5 text-xs font-semibold text-emerald-400">
              {event.score}分
            </span>
          )}
        </div>
      </div>

      {/* 标题 */}
      <h3 className="text-base font-semibold leading-snug group-hover:text-emerald-400 transition">
        <a href={event.source_url} target="_blank" rel="noopener noreferrer">
          {event.title}
        </a>
      </h3>

      {/* 高校 + 日期 */}
      <p className="mt-1.5 text-sm text-zinc-400">
        🏫 {event.university || '未知高校'}
      </p>
      <p className="text-xs text-zinc-500">
        📅 {dateStr}{endStr}
        {event.location ? ` · 📍 ${event.location}` : ''}
      </p>

      {/* 描述 */}
      {event.description && (
        <p className="mt-2 text-xs leading-relaxed text-zinc-600 line-clamp-2">
          {event.description}
        </p>
      )}

      {/* 底部操作 */}
      <div className="mt-3 flex items-center justify-between gap-2 border-t border-zinc-800 pt-3">
        <div className="flex flex-col gap-0.5 text-xs min-w-0">
          {event.contact_email ? (
            <span className="text-emerald-500 truncate">
              ✉️ {event.contact_email}
            </span>
          ) : (
            <span className="text-zinc-600 whitespace-nowrap">✉️ 无联系方式</span>
          )}
          {event.contact_phone && (
            <span className="text-zinc-500 truncate">📞 {event.contact_phone}</span>
          )}
        </div>

        <div className="flex gap-2 shrink-0">
          {event.contact_email ? (
            <button
              onClick={onSendMail}
              className="rounded-lg bg-amber-700 px-3 py-1 text-xs font-medium text-white hover:bg-amber-600 transition whitespace-nowrap"
            >
              📧 发送邮件
            </button>
          ) : (
            <span className="text-xs text-zinc-600 whitespace-nowrap">暂无邮箱</span>
          )}
          <a
            href={event.source_url}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-lg border border-zinc-700 px-3 py-1 text-xs text-zinc-400 hover:border-zinc-500 hover:text-zinc-200 transition whitespace-nowrap"
          >
            来源
          </a>
        </div>
      </div>
    </div>
  );
}
