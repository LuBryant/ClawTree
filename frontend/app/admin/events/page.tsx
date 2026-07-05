'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  fetchEvents, fetchEventStats, generateEmail,
  type UniversityEvent, type EventStats, type EventsFilter, type GenerateEmailResult,
} from '../../lib/api-client';
import { useLanguage } from '../../i18n/LanguageProvider';
import { DEMO_WORKSPACE } from '../../config/workspaces';

const CATEGORIES = ['', 'AI', 'Web3', 'AI+Web3'] as const;
const EVENT_TYPES = ['', '黑客松', '分享会', '讲座', '竞赛', '研讨会', '论坛', '工作坊', '其他'] as const;
const CAT_LABEL: Record<string, string> = { '': '全部分类', AI: '🤖 AI', Web3: '⛓️ Web3', 'AI+Web3': '⚡ AI+Web3' };
const TYPE_LABEL: Record<string, string> = { '': '全部类型', '黑客松': '💻 黑客松', '分享会': '🎯 分享会', '讲座': '🎙️ 讲座', '竞赛': '🏆 竞赛', '研讨会': '🎓 研讨会', '论坛': '🎤 论坛', '工作坊': '🔧 工作坊', '其他': '📌 其他' };
const TYPE_LABEL_EN: Record<string, string> = { '': 'All types', '黑客松': '💻 Hackathon', '分享会': '🎯 Meetup', '讲座': '🎙️ Lecture', '竞赛': '🏆 Competition', '研讨会': '🎓 Seminar', '论坛': '🎤 Forum', '工作坊': '🔧 Workshop', '其他': '📌 Other' };

const DEFAULT_TEMPLATE = `尊敬的 {高校名称} 老师：

您好！我是${DEMO_WORKSPACE.name}的 {你的名字}。

我们注意到贵校即将举办「{活动标题}」，活动内容与当前工作区关注的 AI/Web3 高校生态高度契合。

${DEMO_WORKSPACE.name}高校行是本次 ClawTree 演示案例中的媒体与活动品牌场景，聚焦 Web3+AI 领域。我们希望能与贵校探讨以下合作方向：

1. 媒体支持与活动复盘
2. AI/Web3 主题公开课或圆桌联动
3. 高校行联合活动的人工评估

以上为模拟草稿，必须进入 /admin/outreach 逐校审批；不得直接发送，不得 BCC 群发。

此致
敬礼

${DEMO_WORKSPACE.outreachSignature}`;
const DEFAULT_TEMPLATE_EN = `Dear {University} team,

I’m {Your name} from ${DEMO_WORKSPACE.nameEn}. We noticed your upcoming event, “{Event title},” and see a strong fit with the campus AI/Web3 ecosystem covered by this workspace.

${DEMO_WORKSPACE.nameEn} campus tour is the media/events scenario used in this ClawTree demo case, focused on Web3 + AI and a global campus program. We would love to explore media support and recaps, AI/Web3 classes or roundtables, and a human-reviewed joint event.

This is a simulated draft. It must be reviewed per campus in /admin/outreach. Do not send directly or via BCC.

${DEMO_WORKSPACE.outreachSignatureEn}`;

export default function AdminEventsPage() {
  const { language, tx } = useLanguage();
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
  const [template, setTemplate] = useState(() => language === 'zh' ? DEFAULT_TEMPLATE : DEFAULT_TEMPLATE_EN);
  const [reviewNotice, setReviewNotice] = useState('');
  const [generating, setGenerating] = useState(false);
  const [emailResults, setEmailResults] = useState<GenerateEmailResult[]>([]);

  const load = useCallback(async (f: EventsFilter, p: number) => {
    setLoading(true); setError('');
    try { const [d, s] = await Promise.all([fetchEvents({ ...f, page: p }), fetchEventStats()]); setEvents(d.results); setTotal(d.count); setStats(s); }
    catch { setError(tx('无法连接后端 API，请确保 python manage.py runserver 正在运行', 'Unable to reach the backend API. Make sure python manage.py runserver is running.')); }
    finally { setLoading(false); }
  }, [tx]);

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

  const sendOne = async (e: UniversityEvent) => {
    setGenerating(true); setReviewNotice('');
    try {
      const res = await generateEmail([e.id]);
      setEmailResults(res.results);
      setReviewNotice(tx(`已为「${e.title}」AI 生成合作邀请草稿。必须进入 /admin/outreach 逐校审批，不得直接发送。`, `AI generated a partnership draft for “${e.title}”. Review it per campus in /admin/outreach before sending.`));
    } catch {
      setReviewNotice(tx('AI 生成失败，请确认后端已配置 DEEPSEEK_API_KEY', 'AI generation failed. Confirm DEEPSEEK_API_KEY is configured on the backend.'));
    } finally {
      setGenerating(false);
    }
  };

  const sendBatch = async () => {
    if (!selEvents.length) { alert(tx('请先选择活动', 'Select at least one event')); return; }
    const ids = selEvents.map((e) => e.id);
    setGenerating(true); setReviewNotice('');
    try {
      const res = await generateEmail(ids);
      setEmailResults(res.results);
      setReviewNotice(tx(`已为 ${ids.length} 个活动 AI 生成合作邀请草稿。批量仅为进入审批队列，每校一封独立草稿，不得 BCC 群发。`, `AI generated ${ids.length} partnership drafts for the approval queue. Each campus has a separate draft; never use BCC.`));
    } catch {
      setReviewNotice(tx('AI 生成失败，请确认后端已配置 DEEPSEEK_API_KEY', 'AI generation failed. Confirm DEEPSEEK_API_KEY is configured on the backend.'));
    } finally {
      setGenerating(false);
    }
  };

  const pages = Math.ceil(total / PS);

  return (
    <div className="flex flex-col gap-6">
      {/* 页头 */}
      <section className="flex items-center justify-between">
        <div>
          <h1 className="font-normal leading-none tracking-tight" style={{ fontSize: 'clamp(1.6rem, 3.5vw, 2.6rem)' }}>{tx('活动浏览器', 'Event Browser')}</h1>
          <p className="mt-1 text-sm" style={{ color: 'var(--muted)' }}>
            {tx('AI Agent 自动采集的高校 AI/Web3 活动', 'Campus AI/Web3 events collected by the AI Agent')}
            {stats && <span> — <span style={{ color: 'var(--success)', fontWeight: 950 }}>{stats.total}</span> {tx('条，已联系', 'events; contacted')} <span style={{ color: 'var(--success)', fontWeight: 950 }}>{stats.contacted}</span></span>}
          </p>
          <p className="mt-2 text-xs font-bold" style={{ color: 'var(--warning)' }}>
            {tx('本页不会打开邮箱、不会发送、不会写外部系统；批量只生成草稿，每校仍是一封独立草稿。', 'This page never opens email, sends messages, or writes to external systems. Batch actions only generate one independent draft per campus.')}
          </p>
        </div>
        <button className="btn-outline" onClick={() => setShowModal(true)}>📝 {tx('草稿模板', 'Draft template')}</button>
      </section>

      {/* 筛选栏 */}
      <section className="flex flex-wrap items-center gap-3">
        <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && doSearch()}
          placeholder={tx('搜索标题、高校…', 'Search titles or universities…')} className="input-field w-full sm:w-64" />
          <button className="btn btn-success btn-sm" onClick={doSearch}>{tx('搜索', 'Search')}</button>
        <select value={filter.category || ''} onChange={(e) => { setFilter((f) => ({ ...f, category: e.target.value })); setPage(1); }} className="select-field">
          {CATEGORIES.map((c) => (<option key={c} value={c}>{c === '' ? tx('全部分类', 'All categories') : CAT_LABEL[c]}</option>))}
        </select>
        <select value={filter.event_type || ''} onChange={(e) => { setFilter((f) => ({ ...f, event_type: e.target.value })); setPage(1); }} className="select-field">
          {EVENT_TYPES.map((t) => (<option key={t} value={t}>{language === 'zh' ? TYPE_LABEL[t] : TYPE_LABEL_EN[t]}</option>))}
        </select>
        <select value={filter.ordering || '-created_at'} onChange={(e) => { setFilter((f) => ({ ...f, ordering: e.target.value })); setPage(1); }} className="select-field">
          <option value="-created_at">{tx('最新收录', 'Recently added')}</option>
          <option value="-score">{tx('评分最高', 'Highest score')}</option>
          <option value="event_date">{tx('活动日期', 'Event date')} ↑</option>
          <option value="-event_date">{tx('活动日期', 'Event date')} ↓</option>
        </select>
      </section>

      {/* 批量操作栏 */}
      {selected.size > 0 && (
        <section style={{ border: '1px solid rgba(248,214,109,0.42)', background: 'rgba(248,214,109,0.06)', padding: '14px 20px', display: 'flex', alignItems: 'center', gap: 14 }}>
          <span className="text-sm font-black" style={{ color: 'var(--warning)' }}>{tx('已选', 'Selected')} {selected.size}</span>
          <button className="btn btn-warning btn-sm" onClick={sendBatch} disabled={generating}>
            {generating ? tx('⏳ AI 生成中...', '⏳ AI generating...') : tx('📝 ai批量生成邮件文案', '📝 Generate email drafts')}
          </button>
          <button className="btn-outline btn-sm" onClick={() => setSelected(new Set())}>{tx('取消选择', 'Clear selection')}</button>
        </section>
      )}

      {reviewNotice && (
        <section style={{ border: '1px solid rgba(22,242,179,0.38)', background: 'rgba(22,242,179,0.06)', padding: '14px 20px' }}>
          <p className="text-sm font-bold" style={{ color: 'var(--success)' }}>{reviewNotice}</p>
          <a className="btn-outline btn-sm mt-3 inline-flex" href="/admin/outreach">{tx('前往外联审批台', 'Open outreach review')}</a>
        </section>
      )}

      {emailResults.length > 0 && (
        <section className="flex flex-col gap-4">
          {emailResults.map((r) => (
            <div key={r.event_id} className="panel" style={{ padding: '18px' }}>
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-black uppercase tracking-wider" style={{ color: 'var(--warning)' }}>
                  📧 {r.university} — {r.title}
                </h3>
                <span className="text-xs" style={{ color: 'var(--muted)' }}>{tx('草稿 · 待审批', 'Draft · Awaiting approval')}</span>
              </div>
              <pre className="text-xs leading-relaxed whitespace-pre-wrap" style={{ color: 'var(--text-dim)', fontFamily: 'inherit' }}>
                {r.email_body}
              </pre>
            </div>
          ))}
        </section>
      )}

      {/* 全选 */}
      {!loading && !error && events.length > 0 && (
        <label className="flex items-center gap-2 text-sm font-black uppercase tracking-wider cursor-pointer select-none" style={{ color: 'var(--muted)' }}>
          <input type="checkbox" checked={selected.size === events.length && events.length > 0} onChange={selectAll} /> {tx('全选本页', 'Select this page')}
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
              <EventCard key={e.id} event={e} sel={selected.has(e.id)} onToggle={() => toggle(e.id)} onSend={() => sendOne(e)} generating={generating} />
            ))}
            {events.length === 0 && <div className="col-span-full py-16 text-center" style={{ color: 'var(--muted)' }}>{tx('暂无匹配数据', 'No matching events')}</div>}
          </section>
          {pages > 1 && (
            <section className="flex items-center justify-center gap-2 py-4">
              <button className="btn-outline btn-sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)} style={{ opacity: page <= 1 ? 0.3 : 1 }}>← {tx('上一页', 'Previous')}</button>
              <span className="text-sm font-black" style={{ color: 'var(--muted)' }}>{page} / {pages}</span>
              <button className="btn-outline btn-sm" disabled={page >= pages} onClick={() => setPage((p) => p + 1)} style={{ opacity: page >= pages ? 0.3 : 1 }}>{tx('下一页', 'Next')} →</button>
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
              <h2 className="text-xl font-black uppercase tracking-wider">📝 {tx('模拟草稿模板', 'Simulated draft template')}</h2>
              <button onClick={() => setShowModal(false)} className="text-xl leading-none" style={{ color: 'var(--muted)' }}>✕</button>
            </div>
            <p className="text-xs mb-4" style={{ color: 'var(--muted)' }}>
              {tx('变量', 'Variables')}: <code style={{ color: 'var(--warning)' }}>{tx('{高校名称}', '{University}')}</code> <code style={{ color: 'var(--warning)' }}>{tx('{活动标题}', '{Event title}')}</code>. {tx('本页仅生成草稿，不打开邮箱、不发送、不 BCC。', 'This page only generates drafts. It never opens email, sends, or uses BCC.')}
            </p>
            <label className="block text-xs font-black uppercase tracking-wider mb-1" style={{ color: 'var(--muted)' }}>{tx('邮件正文', 'Email body')}</label>
            <textarea value={template} onChange={(e) => setTemplate(e.target.value)} rows={14}
              className="input-field w-full resize-y mono text-xs leading-relaxed" />
            <div className="flex gap-3 mt-4 justify-end">
              <button className="btn-outline btn-sm" onClick={() => setTemplate(language === 'zh' ? DEFAULT_TEMPLATE : DEFAULT_TEMPLATE_EN)}>{tx('恢复默认', 'Restore default')}</button>
              <button className="btn btn-success btn-sm" onClick={() => setShowModal(false)}>{tx('保存模板', 'Save template')}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */

function EventCard({ event: e, sel, onToggle, onSend, generating }: { event: UniversityEvent; sel: boolean; onToggle: () => void; onSend: () => void; generating: boolean }) {
  const { tx } = useLanguage();
  const dateStr = e.event_date || tx('日期待定', 'Date TBD');
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
      <p className="text-sm mt-1" style={{ color: 'var(--text-dim)' }}>🏫 {e.university || tx('未知高校', 'University pending')}</p>
      <p className="text-xs mt-0.5" style={{ color: 'var(--muted)' }}>📅 {dateStr}{endStr}{e.location ? ` · 📍 ${e.location}` : ''}</p>
      {e.description && <p className="mt-2.5 text-xs leading-relaxed line-clamp-2" style={{ color: 'var(--muted)' }}>{e.description}</p>}
      <div className="mt-3 flex flex-col gap-2 pt-3" style={{ borderTop: '1px solid var(--line)' }}>
        <div className="flex flex-col gap-0.5 text-xs">
          {e.contact_email ? <span style={{ color: 'var(--success)', wordBreak: 'break-all' }}>✉️ {e.contact_email}</span> : <span className="text-xs" style={{ color: 'var(--muted)' }}>✉️ {tx('无邮箱', 'No email')}</span>}
          {e.contact_ai_email && <span style={{ color: 'var(--success)' }}>🤖 {tx('AI部门', 'AI team')}: {e.contact_ai_email}</span>}
          {e.contact_wechat && <span style={{ color: 'var(--success)' }}>💬 {e.contact_wechat}</span>}
          {e.contact_phone && <span style={{ color: 'var(--success)' }}>📞 {e.contact_phone}</span>}
        </div>
        <div className="flex gap-2">
          {e.contact_email ? <button className="btn btn-warning btn-sm" onClick={onSend} disabled={generating}>{generating ? tx('⏳ AI 生成中...', '⏳ AI generating...') : tx('📝 ai生成邮件文案', '📝 Generate email draft')}</button> : <span className="text-xs font-bold" style={{ color: 'var(--muted)' }}>{tx('待补联系证据', 'Contact evidence needed')}</span>}
          <a href={e.source_url} target="_blank" rel="noopener noreferrer" className="btn-outline btn-sm" style={{ minHeight: 36, padding: '0 14px', fontSize: '0.78rem' }}>{tx('来源', 'Source')}</a>
        </div>
      </div>
    </div>
  );
}
