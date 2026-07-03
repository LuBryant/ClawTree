'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  fetchEvents, fetchEventStats,
  type UniversityEvent, type EventStats, type EventsFilter,
} from '../../lib/api-client';

const CATEGORIES = ['', 'AI', 'Web3', 'AI+Web3'] as const;
const EVENT_TYPES = ['', '黑客松', '分享会', '讲座', '竞赛', '研讨会', '论坛', '工作坊', '其他'] as const;
const CAT_LABEL: Record<string, string> = { '': '全部分类', AI: '🤖 AI', Web3: '⛓️ Web3', 'AI+Web3': '⚡ AI+Web3' };
const TYPE_LABEL: Record<string, string> = { '': '全部类型', '黑客松': '💻 黑客松', '分享会': '🎯 分享会', '讲座': '🎙️ 讲座', '竞赛': '🏆 竞赛', '研讨会': '🎓 研讨会', '论坛': '🎤 论坛', '工作坊': '🔧 工作坊', '其他': '📌 其他' };

const DEFAULT_TEMPLATE = `尊敬的 {高校名称} 老师：

您好！我是大树财经的 {你的名字}。

我们注意到贵校即将举办「{活动标题}」，活动内容与大树财经关注的 AI/Web3 高校生态高度契合。

大树财经是 Web3+AI 领域的媒体与活动品牌，正推动全球高校行计划，已成功支持多场黑客松和学术论坛。我们希望能与贵校探讨以下合作方向：

1. 媒体支持与活动复盘
2. AI/Web3 主题公开课或圆桌联动
3. 高校行联合活动的人工评估

以上为模拟草稿，必须进入 /admin/outreach 逐校审批；不得直接发送，不得 BCC 群发。

此致
敬礼

大树财经高校行团队`;

export default function AdminEventsPage() {
  const [events, setEvents] = useState<UniversityEvent[]>([]);
  const [stats, setStats] = useState<EventStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const PS = 12;

  const [filter, setFilter] = useState<EventsFilter>({ category: '', event_type: '', ordering: '-created_at' });
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [showModal, setShowModal] = useState(false);
  const [template, setTemplate] = useState(DEFAULT_TEMPLATE);
  const [reviewNotice, setReviewNotice] = useState('');

  const load = useCallback(async (f: EventsFilter, p: number) => {
    setLoading(true); setError('');
    try { const [d, s] = await Promise.all([fetchEvents({ ...f, page: p }), fetchEventStats()]); setEvents(d.results); setTotal(d.count); setStats(s); }
    catch { setError('无法连接后端 API，请确保 python manage.py runserver 正在运行'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(filter, page); }, [filter, page, load]);
  useEffect(() => { setSelected(new Set()); }, [page, filter]);

  const doSearch = () => { setFilter((f) => ({ ...f, search })); setPage(1); };
  const toggle = (id: number) => setSelected((p) => {
    const n = new Set(p);
    if (n.has(id)) n.delete(id); else n.add(id);
    return n;
  });
  const selectAll = () => setSelected(selected.size === events.length ? new Set() : new Set(events.map((e) => e.id)));
  const selEvents = events.filter((e) => selected.has(e.id));

  const buildMail = (e: UniversityEvent) => template
    .replace(/\{高校名称\}/g, e.university || '贵校')
    .replace(/\{活动标题\}/g, e.title)
    .replace(/\{你的名字\}/g, '大树财经高校行团队');

  const sendOne = (e: UniversityEvent) => {
    const body = buildMail(e);
    setReviewNotice(`已为「${e.title}」生成一校一稿模拟草稿（${body.length} 字）。请进入 /admin/outreach 完成人工审批；本页不会打开邮箱、不会发送、不会写外部系统。`);
  };

  const sendBatch = () => {
    if (!selEvents.length) { alert('请先选择活动'); return; }
    const draftCount = selEvents.length;
    setReviewNotice(`已生成 ${draftCount} 个独立模拟草稿。批量仅表示批量进入审批队列；每校仍是一封独立草稿，本页不会 BCC、不会发送、不会写外部系统。`);
  };

  const pages = Math.ceil(total / PS);

  return (
    <div className="flex flex-col gap-6">
      {/* 页头 */}
      <section className="flex items-center justify-between">
        <div>
          <h1 className="font-normal leading-none tracking-tight" style={{ fontSize: 'clamp(1.6rem, 3.5vw, 2.6rem)' }}>活动浏览器</h1>
          <p className="mt-1 text-sm" style={{ color: 'var(--muted)' }}>
            AI Agent 自动采集的高校 AI/Web3 活动
            {stats && <span> — 共 <span style={{ color: 'var(--success)', fontWeight: 950 }}>{stats.total}</span> 条，已联系 <span style={{ color: 'var(--success)', fontWeight: 950 }}>{stats.contacted}</span> 条</span>}
          </p>
        </div>
        <button className="btn-outline" onClick={() => setShowModal(true)}>📝 草稿模板</button>
      </section>

      {/* 筛选栏 */}
      <section className="flex flex-wrap items-center gap-3">
        <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && doSearch()}
          placeholder="搜索标题、高校…" className="input-field w-full sm:w-64" />
          <button className="btn btn-success btn-sm" onClick={doSearch}>搜索</button>
        <select value={filter.category || ''} onChange={(e) => { setFilter((f) => ({ ...f, category: e.target.value })); setPage(1); }} className="select-field">
          {CATEGORIES.map((c) => (<option key={c} value={c}>{CAT_LABEL[c]}</option>))}
        </select>
        <select value={filter.event_type || ''} onChange={(e) => { setFilter((f) => ({ ...f, event_type: e.target.value })); setPage(1); }} className="select-field">
          {EVENT_TYPES.map((t) => (<option key={t} value={t}>{TYPE_LABEL[t]}</option>))}
        </select>
        <select value={filter.ordering || '-created_at'} onChange={(e) => { setFilter((f) => ({ ...f, ordering: e.target.value })); setPage(1); }} className="select-field">
          <option value="-created_at">最新收录</option>
          <option value="-score">评分最高</option>
          <option value="event_date">活动日期 ↑</option>
          <option value="-event_date">活动日期 ↓</option>
        </select>
      </section>

      {/* 批量操作栏 */}
      {selected.size > 0 && (
        <section style={{ border: '1px solid rgba(248,214,109,0.42)', background: 'rgba(248,214,109,0.06)', padding: '14px 20px', display: 'flex', alignItems: 'center', gap: 14 }}>
          <span className="text-sm font-black" style={{ color: 'var(--warning)' }}>已选 {selected.size} 项</span>
          <button className="btn btn-warning btn-sm" onClick={sendBatch}>📝 生成逐校审批草稿</button>
          <button className="btn-outline btn-sm" onClick={() => setSelected(new Set())}>取消选择</button>
        </section>
      )}

      {reviewNotice && (
        <section style={{ border: '1px solid rgba(22,242,179,0.38)', background: 'rgba(22,242,179,0.06)', padding: '14px 20px' }}>
          <p className="text-sm font-bold" style={{ color: 'var(--success)' }}>{reviewNotice}</p>
          <a className="btn-outline btn-sm mt-3 inline-flex" href="/admin/outreach">前往外联审批台</a>
        </section>
      )}

      {/* 全选 */}
      {!loading && !error && events.length > 0 && (
        <label className="flex items-center gap-2 text-sm font-black uppercase tracking-wider cursor-pointer select-none" style={{ color: 'var(--muted)' }}>
          <input type="checkbox" checked={selected.size === events.length && events.length > 0} onChange={selectAll} /> 全选本页
        </label>
      )}

      {/* 错误 */}
      {error && (
        <div className="text-center py-8" style={{ border: '1px solid rgba(255,61,87,0.42)', background: 'rgba(255,61,87,0.08)', color: 'var(--danger)' }}>
          <p className="text-sm font-bold">{error}</p>
        </div>
      )}

      {/* 加载 */}
      {loading && <div className="flex justify-center py-20"><div className="spinner" /></div>}

      {/* 列表 */}
      {!loading && !error && (
        <>
          <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {events.map((e) => (
              <EventCard key={e.id} event={e} sel={selected.has(e.id)} onToggle={() => toggle(e.id)} onSend={() => sendOne(e)} />
            ))}
            {events.length === 0 && <div className="col-span-full py-16 text-center" style={{ color: 'var(--muted)' }}>暂无匹配数据</div>}
          </section>
          {pages > 1 && (
            <section className="flex items-center justify-center gap-2 py-4">
              <button className="btn-outline btn-sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)} style={{ opacity: page <= 1 ? 0.3 : 1 }}>← 上一页</button>
              <span className="text-sm font-black" style={{ color: 'var(--muted)' }}>{page} / {pages}</span>
              <button className="btn-outline btn-sm" disabled={page >= pages} onClick={() => setPage((p) => p + 1)} style={{ opacity: page >= pages ? 0.3 : 1 }}>下一页 →</button>
            </section>
          )}
        </>
      )}

      {/* 邮件模板弹窗 */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center modal-backdrop">
          <div className="mx-4 w-full max-w-2xl max-h-[90vh] overflow-y-auto"
            style={{ border: '1px solid rgba(22,242,179,0.2)', background: 'linear-gradient(135deg, rgba(22,242,179,0.06), rgba(120,166,255,0.04) 50%, rgba(248,214,109,0.06)), #081118', boxShadow: '0 24px 80px rgba(0,0,0,0.55)', padding: '24px' }}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-black uppercase tracking-wider">📝 模拟草稿模板</h2>
              <button onClick={() => setShowModal(false)} className="text-xl leading-none" style={{ color: 'var(--muted)' }}>✕</button>
            </div>
            <p className="text-xs mb-4" style={{ color: 'var(--muted)' }}>
              变量：<code style={{ color: 'var(--warning)' }}>{'{高校名称}'}</code> <code style={{ color: 'var(--warning)' }}>{'{活动标题}'}</code>。本页仅生成草稿，不打开邮箱、不发送、不 BCC。
            </p>
            <label className="block text-xs font-black uppercase tracking-wider mb-1" style={{ color: 'var(--muted)' }}>邮件正文</label>
            <textarea value={template} onChange={(e) => setTemplate(e.target.value)} rows={14}
              className="input-field w-full resize-y mono text-xs leading-relaxed" />
            <div className="flex gap-3 mt-4 justify-end">
              <button className="btn-outline btn-sm" onClick={() => setTemplate(DEFAULT_TEMPLATE)}>恢复默认</button>
              <button className="btn btn-success btn-sm" onClick={() => setShowModal(false)}>保存模板</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */

function EventCard({ event: e, sel, onToggle, onSend }: { event: UniversityEvent; sel: boolean; onToggle: () => void; onSend: () => void }) {
  const dateStr = e.event_date || '日期待定';
  const endStr = e.event_end_date ? ` → ${e.event_end_date}` : '';
  const catColors: Record<string, string> = { AI: 'var(--info)', Web3: 'var(--warning)', 'AI+Web3': 'var(--danger)' };
  const catBgs: Record<string, string> = { AI: 'rgba(120,166,255,0.12)', Web3: 'rgba(248,214,109,0.1)', 'AI+Web3': 'rgba(255,61,87,0.1)' };
  const cc = catColors[e.category] || 'var(--info)';
  const cb = catBgs[e.category] || 'rgba(120,166,255,0.12)';

  return (
    <div className="event-card"
      style={{ border: `1px solid ${sel ? 'rgba(248,214,109,0.5)' : 'var(--line)'}`, background: sel ? 'rgba(248,214,109,0.06)' : 'var(--panel)', boxShadow: '0 18px 60px rgba(0,0,0,0.22)', padding: '18px' }}>
      <div className="flex items-center justify-between mb-2.5">
        <div className="flex items-center gap-2">
          <input type="checkbox" checked={sel} onChange={onToggle} />
          <span className="badge" style={{ borderColor: cc, background: cb, color: cc }}>{e.category}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs font-black uppercase tracking-wider" style={{ color: 'var(--muted)' }}>{e.event_type}</span>
          {e.score > 0 && <span className="badge badge-success" style={{ fontSize: '0.68rem' }}>{e.score}P</span>}
        </div>
      </div>
      <h3 className="text-base font-bold leading-snug mb-1.5">
        <a href={e.source_url} target="_blank" rel="noopener noreferrer" className="hover:underline">{e.title}</a>
      </h3>
      <p className="text-sm mt-1" style={{ color: 'var(--text-dim)' }}>🏫 {e.university || '未知高校'}</p>
      <p className="text-xs mt-0.5" style={{ color: 'var(--muted)' }}>📅 {dateStr}{endStr}{e.location ? ` · 📍 ${e.location}` : ''}</p>
      {e.description && <p className="mt-2.5 text-xs leading-relaxed line-clamp-2" style={{ color: 'var(--muted)' }}>{e.description}</p>}
      <div className="mt-3 flex items-center justify-between gap-2 pt-3" style={{ borderTop: '1px solid var(--line)' }}>
        <div className="flex flex-col gap-0.5 text-xs min-w-0">
          {e.contact_email ? <span className="truncate" style={{ color: 'var(--success)' }}>✉️ 公开联系证据已记录（默认遮罩）</span> : <span className="whitespace-nowrap" style={{ color: 'var(--muted)' }}>✉️ 无公开联系证据</span>}
          {e.contact_wechat && <span className="truncate" style={{ color: 'var(--muted)' }}>💬 微信已收录，需授权视图查看</span>}
          {e.contact_phone && <span className="truncate" style={{ color: 'var(--muted)' }}>📞 电话已隐藏，需授权视图查看</span>}
        </div>
        <div className="flex gap-2 shrink-0">
          {e.contact_email ? <button className="btn btn-warning btn-sm" onClick={onSend}>📝 生成草稿</button> : <span className="text-xs whitespace-nowrap font-bold" style={{ color: 'var(--muted)' }}>待补联系证据</span>}
          <a href={e.source_url} target="_blank" rel="noopener noreferrer" className="btn-outline btn-sm whitespace-nowrap" style={{ minHeight: 36, padding: '0 14px', fontSize: '0.78rem' }}>来源</a>
        </div>
      </div>
    </div>
  );
}
