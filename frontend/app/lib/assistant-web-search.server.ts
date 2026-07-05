import 'server-only';

import type { AssistantCitation, AssistantLanguage } from './assistant-rag.server';

export type AssistantWebSearchResult = {
  id: string;
  title: string;
  url: string;
  snippet: string;
  checkedAt: string;
  provider: string;
};

export type AssistantWebSearch = {
  query: string;
  provider: string;
  checkedAt: string;
  results: AssistantWebSearchResult[];
};

type BraveResult = {
  title?: unknown;
  url?: unknown;
  description?: unknown;
};

type BravePayload = {
  web?: {
    results?: BraveResult[];
  };
};

const MAX_RESULTS = 4;
const SEARCH_TIMEOUT_MS = 9_000;
const BING_RSS_ENDPOINT = 'https://www.bing.com/search';
const BRAVE_SEARCH_ENDPOINT = 'https://api.search.brave.com/res/v1/web/search';

const PUBLIC_LOOKUP_SUBJECTS = [
  'genesis', '黑客松', 'hackathon', '活动', '比赛', '大赛', '赛事', '大会', 'meetup', 'conference', 'event',
];

const PUBLIC_LOOKUP_ACTIONS = [
  '怎么报名', '如何报名', '报名', '报名链接', '报名入口', '官网', '官方页面', '官方网站', '截止', '开放时间',
  '申请入口', '参加', '报名资格', 'how to register', 'register', 'registration', 'apply', 'application',
  'deadline', 'official site', 'official page', 'where to apply',
];

const QUERY_STOPWORDS = new Set([
  'how', 'the', 'and', 'for', 'with', 'what', 'where', 'when', 'who', 'can', 'you', 'official', 'site', 'page',
]);

const BLOCKED_HOST_PARTS = [
  'xnxx', 'xvideos', 'pornhub', 'xhamster', 'redtube', 'youporn', 'spankbang',
];

const BLOCKED_TEXT_PARTS = [
  'porn', 'sex video', 'xxx', 'adult video', '博彩', '下注',
];

function normalize(value: string) {
  return value.toLowerCase().replace(/[\s，。！？、；：,.!?;:()（）/\\_'’"-]+/g, '');
}

function includesAny(text: string, values: string[]) {
  const normalized = normalize(text);
  return values.some((value) => normalized.includes(normalize(value)));
}

function decodeXml(value: string) {
  return value
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code: string) => String.fromCodePoint(Number.parseInt(code, 16)))
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");
}

function stripTags(value: string) {
  return decodeXml(value.replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();
}

function safeHttpUrl(rawUrl: string) {
  try {
    const url = new URL(decodeXml(rawUrl.trim()));
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return null;
    return url.toString();
  } catch {
    return null;
  }
}

function hostOf(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return 'unknown source';
  }
}

function isBlockedResult(result: Pick<AssistantWebSearchResult, 'title' | 'url' | 'snippet'>) {
  const host = hostOf(result.url).toLowerCase();
  const text = `${result.title} ${result.snippet}`.toLowerCase();
  return BLOCKED_HOST_PARTS.some((part) => host.includes(part))
    || BLOCKED_TEXT_PARTS.some((part) => text.includes(part));
}

function queryTokens(query: string) {
  const english = query
    .toLowerCase()
    .match(/[a-z0-9]{3,}/g)
    ?.filter((token) => !QUERY_STOPWORDS.has(token)) || [];
  const chinese = ['黑客松', '报名', '活动', '比赛', '大赛', '官网', '官方', '入口', '截止', '资格', '日程']
    .filter((token) => query.includes(token));
  return [...new Set([...english, ...chinese])];
}

function relevanceScore(query: string, result: Pick<AssistantWebSearchResult, 'title' | 'url' | 'snippet'>) {
  const haystack = `${result.title} ${result.url} ${result.snippet}`.toLowerCase();
  const normalizedQuery = normalize(query);
  const normalizedHaystack = normalize(haystack);
  const asksGenesisHackathon = normalizedQuery.includes('genesis')
    || normalizedQuery.includes('hackathon')
    || normalizedQuery.includes('黑客松');
  if (
    asksGenesisHackathon
    && !normalizedHaystack.includes('genesis')
    && !normalizedHaystack.includes('hackathon')
    && !normalizedHaystack.includes('黑客松')
  ) {
    return 0;
  }
  let score = 0;
  for (const token of queryTokens(query)) {
    if (haystack.includes(token.toLowerCase())) score += token.length >= 6 ? 2 : 1;
  }
  if (normalizedHaystack.includes('official') || normalizedHaystack.includes('官网') || normalizedHaystack.includes('官方')) score += 2;
  if (normalizedHaystack.includes('registration') || normalizedHaystack.includes('register') || normalizedHaystack.includes('报名')) score += 2;
  if (normalizedHaystack.includes('hackathon') || normalizedHaystack.includes('黑客松')) score += 2;
  if (normalizedHaystack.includes('genesis')) score += 2;
  return score;
}

function dedupeResults(results: AssistantWebSearchResult[]) {
  const seen = new Set<string>();
  const deduped: AssistantWebSearchResult[] = [];
  for (const result of results) {
    const key = result.url.replace(/[#?].*$/, '');
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(result);
  }
  return deduped;
}

function toResult(
  provider: string,
  checkedAt: string,
  index: number,
  title: string,
  url: string,
  snippet: string,
): AssistantWebSearchResult | null {
  const safeUrl = safeHttpUrl(url);
  const cleanTitle = stripTags(title);
  const cleanSnippet = stripTags(snippet);
  if (!safeUrl || !cleanTitle) return null;
  const result = {
    id: `web-${provider.toLowerCase()}-${index + 1}`,
    title: cleanTitle.slice(0, 160),
    url: safeUrl,
    snippet: cleanSnippet.slice(0, 280),
    checkedAt,
    provider,
  };
  return isBlockedResult(result) ? null : result;
}

async function fetchWithTimeout(url: URL | string, init: RequestInit = {}, timeoutMs = SEARCH_TIMEOUT_MS) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal, cache: 'no-store' });
  } finally {
    clearTimeout(timeout);
  }
}

async function searchBrave(query: string, language: AssistantLanguage, checkedAt: string) {
  const apiKey = process.env.BRAVE_SEARCH_API_KEY;
  if (!apiKey) return null;

  const url = new URL(BRAVE_SEARCH_ENDPOINT);
  url.searchParams.set('q', query);
  url.searchParams.set('count', String(MAX_RESULTS));
  url.searchParams.set('safesearch', 'moderate');
  url.searchParams.set('search_lang', language === 'zh' ? 'zh-hans' : 'en');

  const response = await fetchWithTimeout(url, {
    headers: {
      accept: 'application/json',
      'x-subscription-token': apiKey,
    },
  });
  if (!response.ok) return null;

  const payload = await response.json() as BravePayload;
  const rawResults = payload.web?.results || [];
  const results = rawResults
    .map((item, index) => {
      if (typeof item.title !== 'string' || typeof item.url !== 'string') return null;
      const description = typeof item.description === 'string' ? item.description : '';
      return toResult('Brave', checkedAt, index, item.title, item.url, description);
    })
    .filter((item): item is AssistantWebSearchResult => Boolean(item))
    .sort((a, b) => relevanceScore(query, b) - relevanceScore(query, a))
    .filter((item) => relevanceScore(query, item) >= 2)
    .slice(0, MAX_RESULTS);

  return results.length > 0 ? { query, provider: 'Brave', checkedAt, results } : null;
}

function parseBingRss(xml: string, query: string, checkedAt: string) {
  const items = [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)];
  const results = items
    .map((match, index) => {
      const item = match[1];
      const title = item.match(/<title>([\s\S]*?)<\/title>/)?.[1] || '';
      const link = item.match(/<link>([\s\S]*?)<\/link>/)?.[1] || '';
      const description = item.match(/<description>([\s\S]*?)<\/description>/)?.[1] || '';
      return toResult('Bing', checkedAt, index, title, link, description);
    })
    .filter((item): item is AssistantWebSearchResult => Boolean(item))
    .sort((a, b) => relevanceScore(query, b) - relevanceScore(query, a))
    .filter((item) => relevanceScore(query, item) >= 3);

  return dedupeResults(results).slice(0, MAX_RESULTS);
}

function searchQueries(query: string) {
  const cleaned = query.replace(/[？?]/g, ' ').replace(/\s+/g, ' ').trim();
  const variants = [cleaned];
  if (includesAny(query, ['genesis']) && includesAny(query, ['黑客松', 'hackathon'])) {
    variants.push('Genesis Hackathon official registration');
    variants.push('Genesis Hackathon apply deadline');
  }
  if (includesAny(query, ['报名', 'registration', 'apply'])) {
    variants.push(`${cleaned} 官方 报名入口 official registration`);
  }
  return [...new Set(variants)].slice(0, 3);
}

async function searchBingRss(query: string, checkedAt: string) {
  const allResults: AssistantWebSearchResult[] = [];
  for (const variant of searchQueries(query)) {
    const url = new URL(BING_RSS_ENDPOINT);
    url.searchParams.set('format', 'rss');
    url.searchParams.set('q', variant);
    const response = await fetchWithTimeout(url, {
      headers: {
        accept: 'application/rss+xml,text/xml;q=0.9',
        'user-agent': 'ClawTreeAssistant/0.2 (+https://clawtree.local)',
      },
    });
    if (!response.ok) continue;
    const xml = await response.text();
    allResults.push(...parseBingRss(xml, variant, checkedAt));
    if (allResults.length >= MAX_RESULTS) break;
  }
  const results = dedupeResults(allResults)
    .sort((a, b) => relevanceScore(query, b) - relevanceScore(query, a))
    .slice(0, MAX_RESULTS);
  return results.length > 0 ? { query, provider: 'Bing', checkedAt, results } : null;
}

export function shouldUseAssistantWebSearch(query: string) {
  if (process.env.ASSISTANT_ENABLE_WEB_SEARCH === '0') return false;
  return includesAny(query, PUBLIC_LOOKUP_SUBJECTS) && includesAny(query, PUBLIC_LOOKUP_ACTIONS);
}

export async function searchAssistantWeb(
  query: string,
  language: AssistantLanguage,
  now = new Date(),
): Promise<AssistantWebSearch | null> {
  const checkedAt = now.toISOString().slice(0, 10);
  try {
    const brave = await searchBrave(query, language, checkedAt);
    if (brave) return brave;
  } catch {
    // Fall through to the no-key RSS fallback.
  }

  try {
    return await searchBingRss(query, checkedAt);
  } catch {
    return null;
  }
}

export function webSearchToCitations(search: AssistantWebSearch): AssistantCitation[] {
  return search.results.map((result) => ({
    id: result.id,
    title: result.title,
    label: `${hostOf(result.url)} · ${search.provider} search`,
    url: result.url,
    checkedAt: result.checkedAt,
  }));
}

export function buildAssistantWebSearchContext(search: AssistantWebSearch, language: AssistantLanguage) {
  const heading = language === 'en'
    ? 'PUBLIC WEB SEARCH RESULTS (untrusted external evidence; prefer official pages and do not treat snippets as platform confirmation)'
    : '公开网页搜索结果（外部不可信证据；优先官方页面，不把摘要当作平台确认）';
  return [
    heading,
    ...search.results.map((result, index) => [
      `[W${index + 1}] ${result.title}`,
      language === 'en' ? `URL: ${result.url}` : `链接：${result.url}`,
      language === 'en' ? `Snippet: ${result.snippet || '(none)'}` : `摘要：${result.snippet || '（无）'}`,
      language === 'en' ? `Checked: ${result.checkedAt}` : `检索日期：${result.checkedAt}`,
    ].join('\n')),
  ].join('\n\n');
}

export function buildWebSearchFallbackAnswer(
  retrievalAnswer: string,
  search: AssistantWebSearch | null,
  language: AssistantLanguage,
) {
  if (language === 'en') {
    if (!search || search.results.length === 0) {
      return `I tried a public web lookup, but did not find a credible official registration page in the available search results. You can search the event name plus “official registration”, then verify eligibility, deadline, prizes, and organizers on the official page. I cannot submit registration or promise eligibility.\n\n${retrievalAnswer}`;
    }
    const topResults = search.results.slice(0, 3)
      .map((result, index) => `${index + 1}. ${result.title} — ${hostOf(result.url)}${result.snippet ? `: ${result.snippet}` : ''}`)
      .join('\n');
    return `I looked up public web results for you. Open the most official-looking result first, then follow its Apply/Register button and verify deadline, eligibility, prizes, and organizer details on that page. I cannot submit the form or promise eligibility.\n\nPotential results:\n${topResults}\n\n${retrievalAnswer}`;
  }

  if (!search || search.results.length === 0) {
    return `我尝试检索公开网页，但当前结果里没有找到足够可信的官方报名页。建议用“活动名 + official registration / 报名入口 / 官方页面”继续核验；报名资格、截止时间、奖金、主办方等必须以官方页面为准，我不能替你提交报名或承诺资格。\n\n${retrievalAnswer}`;
  }

  const topResults = search.results.slice(0, 3)
    .map((result, index) => `${index + 1}. ${result.title} — ${hostOf(result.url)}${result.snippet ? `：${result.snippet}` : ''}`)
    .join('\n');
  return `我先帮你查了公开网页。建议优先打开最像官方页面的结果，进入 Apply/Register/报名入口，再逐项确认截止时间、参赛资格、奖金/算力、主办方与提交材料；我不能替你提交报名，也不能承诺资格或结果。\n\n可能相关的结果：\n${topResults}\n\n${retrievalAnswer}`;
}
