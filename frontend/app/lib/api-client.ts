/**
 * ClawTree 后端 API 客户端
 *
 * 所有数据请求的统一入口，支持服务端和客户端调用。
 */

const API_BASE = process.env.NEXT_PUBLIC_API_URL || '/api';

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
  contact_phone: string;
  category: 'AI' | 'Web3' | 'AI+Web3';
  event_type: '讲座' | '黑客松' | '论坛' | '工作坊' | '其他';
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
  const base = API_BASE.startsWith('http')
    ? API_BASE
    : `${typeof window === 'undefined' ? 'http://127.0.0.1:3000' : window.location.origin}${API_BASE}`;
  const url = new URL(`${base}${path.replace(/\/$/, '')}`);

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
  const url = new URL(`${API_BASE}${path}`);

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
