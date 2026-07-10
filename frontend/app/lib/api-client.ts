/**
 * ClawTree 后端 API 客户端
 *
 * 所有数据请求的统一入口，支持服务端和客户端调用。
 */

const API_BASE = process.env.NEXT_PUBLIC_API_URL || '/api';

function resolvedApiBase() {
  return API_BASE.startsWith('http')
    ? API_BASE
    : `${typeof window === 'undefined' ? 'http://127.0.0.1:3000' : window.location.origin}${API_BASE}`;
}

// ---------------------------------------------------------------------------
// 类型定义
// ---------------------------------------------------------------------------

export interface UniversityEvent {
  id: number;
  title: string;
  university: string;
  event_date: string | null;
  event_end_date: string | null;
  location: string;
  description: string;
  source_url: string;
  source_name: string;
  contact_email: string;
  contact_ai_email: string;
  contact_phone: string;
  contact_wechat: string;
  contact_qq: string;
  category: 'AI' | 'Web3' | 'AI+Web3';
  event_type: '黑客松' | '分享会' | '讲座' | '竞赛' | '研讨会' | '论坛' | '工作坊' | '其他';
  registration_url: string;
  is_contacted: boolean;
  score: number;
  created_at: string;
}

export interface EventsResponse {
  count: number;
  next: string | null;
  previous: string | null;
  results: UniversityEvent[];
}

export interface EventStats {
  total: number;
  by_category: Record<string, number>;
  by_type: Record<string, number>;
  contacted: number;
  uncontacted: number;
}

export interface EventsFilter {
  category?: string;
  event_type?: string;
  university?: string;
  is_contacted?: boolean;
  score_min?: number;
  event_date_from?: string;
  event_date_to?: string;
  search?: string;
  page?: number;
  ordering?: string;
}

// --- 活动回顾 ---

export interface EventReview {
  id: number;
  title: string;
  content: string;
  summary: string;
  source_type: 'manual' | 'twitter';
  source_url: string;
  tweet_id: string | null;
  published_at: string | null;
  created_at: string;
}

export interface ReviewsResponse {
  count: number;
  next: string | null;
  previous: string | null;
  results: EventReview[];
}

export interface ReviewCreatePayload {
  title: string;
  content: string;
  source_type: 'manual';
  source_url?: string;
  published_at?: string;
}

export interface ReviewsFilter {
  source_type?: string;
  search?: string;
  page?: number;
  ordering?: string;
}

// ---------------------------------------------------------------------------
// 请求工具
// ---------------------------------------------------------------------------

async function request<T>(path: string, params?: Record<string, string | number | boolean | undefined>): Promise<T> {
  const url = new URL(`${resolvedApiBase()}${path.replace(/\/$/, '')}`);

  if (params) {
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== '') {
        url.searchParams.set(key, String(value));
      }
    }
  }

  const res = await fetch(url.toString(), {
    headers: { 'Content-Type': 'application/json' },
    next: { revalidate: 60 }, // ISR: 60 秒后重新验证
  });

  if (!res.ok) {
    throw new Error(`API 请求失败: ${res.status} ${res.statusText}`);
  }

  return res.json();
}

async function requestWithBody<T>(
  path: string,
  method: 'POST' | 'PUT' | 'DELETE',
  body?: unknown,
): Promise<T> {
  const url = new URL(`${resolvedApiBase()}${path}`);

  const res = await fetch(url.toString(), {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) {
    throw new Error(`API 请求失败: ${res.status} ${res.statusText}`);
  }

  return res.json();
}

// ---------------------------------------------------------------------------
// API 方法
// ---------------------------------------------------------------------------

/** 获取活动列表（分页 + 筛选） */
export function fetchEvents(filter?: EventsFilter): Promise<EventsResponse> {
  return request<EventsResponse>('/events/', {
    category: filter?.category,
    event_type: filter?.event_type,
    university: filter?.university,
    is_contacted: filter?.is_contacted,
    score_min: filter?.score_min,
    event_date_from: filter?.event_date_from,
    event_date_to: filter?.event_date_to,
    search: filter?.search,
    page: filter?.page,
    ordering: filter?.ordering || '-created_at',
  });
}

/** 获取活动统计 */
export function fetchEventStats(): Promise<EventStats> {
  return request<EventStats>('/events/stats/');
}

/** 获取单个活动详情 */
export function fetchEventDetail(id: number): Promise<UniversityEvent> {
  return request<UniversityEvent>(`/events/${id}/`);
}

/** AI 生成合作邀请邮件 */
export interface GenerateEmailResult {
  event_id: number;
  title: string;
  university: string;
  email_body: string;
}

export function generateEmail(eventIds: number[]): Promise<{ results: GenerateEmailResult[] }> {
  return requestWithBody<{ results: GenerateEmailResult[] }>(
    '/events/generate_email/', 'POST', { event_ids: eventIds },
  );
}

// ---------------------------------------------------------------------------
// 外联审批 API
// ---------------------------------------------------------------------------

export interface OutreachDraft {
  id: number;
  university_event: number;
  university_name: string;
  event_title: string;
  subject: string;
  email_body: string;
  recipient_email: string;
  status: 'draft' | 'awaiting_approval' | 'approved' | 'rejected';
  approved_by: string;
  approved_at: string | null;
  proof_tx_hash: string;
  proof_network: string;
  proof_explorer_url: string;
  proof_created_at: string | null;
  created_at: string;
  updated_at: string;
}

export function fetchOutreachDrafts(): Promise<OutreachDraft[]> {
  return request<{ results: OutreachDraft[] }>('/outreach/').then((r) => r.results);
}

export function approveOutreachDraft(id: number, approvedBy: string, emailBody?: string): Promise<{ status: string; sent?: boolean; reason?: string }> {
  return requestWithBody<{ status: string; sent?: boolean; reason?: string }>(`/outreach/${id}/approve/`, 'POST', { approved_by: approvedBy, email_body: emailBody });
}

export function rejectOutreachDraft(id: number): Promise<{ status: string }> {
  return requestWithBody<{ status: string }>(`/outreach/${id}/reject/`, 'POST');
}

/** 保存链上存证到后端 */
export function anchorOutreachProof(id: number, proof: {
  tx_hash: string;
  network: string;
  explorer_url: string;
}): Promise<{ status: string; proof_tx_hash: string; proof_explorer_url: string }> {
  return requestWithBody<{ status: string; proof_tx_hash: string; proof_explorer_url: string }>(
    `/outreach/${id}/anchor_proof/`, 'POST', proof,
  );
}

// ---------------------------------------------------------------------------
// 活动回顾 API
// ---------------------------------------------------------------------------

/** 获取回顾文章列表（分页 + 筛选） */
export function fetchReviews(filter?: ReviewsFilter): Promise<ReviewsResponse> {
  return request<ReviewsResponse>('/reviews/', {
    source_type: filter?.source_type,
    search: filter?.search,
    page: filter?.page,
    ordering: filter?.ordering || '-created_at',
  });
}

/** 手动提交回顾文章 */
export function createReview(data: ReviewCreatePayload): Promise<EventReview> {
  return requestWithBody<EventReview>('/reviews/', 'POST', data);
}

/** 删除回顾文章 */
export function deleteReview(id: number): Promise<void> {
  return requestWithBody<void>(`/reviews/${id}/`, 'DELETE');
}

// ---------------------------------------------------------------------------
// 推文回顾 API
// ---------------------------------------------------------------------------

export interface TweetReview {
  id: number;
  tweet_id: string;
  text: string;
  text_processed: string;
  media_urls: string;       // JSON 字符串数组，如 '["url1","url2"]'
  twitter_url: string;
  space_url: string;
  space_summary: string;
  summary: string;
  is_review_worthy: boolean;
  is_sensitive: boolean;
  published_at: string | null;
  created_at: string;
}

export interface TweetReviewsResponse {
  count: number;
  next: string | null;
  previous: string | null;
  results: TweetReview[];
}

export interface TweetReviewsFilter {
  is_review_worthy?: boolean;
  search?: string;
  page?: number;
  ordering?: string;
}

/** 获取推文回顾列表（分页 + 筛选） */
export function fetchTweetReviews(filter?: TweetReviewsFilter): Promise<TweetReviewsResponse> {
  return request<TweetReviewsResponse>('/tweet-reviews/', {
    is_review_worthy: filter?.is_review_worthy,
    search: filter?.search,
    page: filter?.page,
    ordering: filter?.ordering || '-published_at',
  });
}

/** 生成 Space 语音节目总结 */
export interface SpaceSummaryResult {
  space_url: string;
  space_summary: string;
  cached: boolean;
}

export function generateSpaceSummary(tweetReviewId: number, force?: boolean): Promise<SpaceSummaryResult> {
  return requestWithBody<SpaceSummaryResult>(
    `/tweet-reviews/${tweetReviewId}/generate_space_summary/`, 'POST', { force },
  );
}
