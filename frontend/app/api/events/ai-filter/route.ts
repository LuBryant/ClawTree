import { createHash } from 'node:crypto';

import { runAgentTaskWithTrace } from '../../../lib/agent-provider.server';

export const runtime = 'nodejs';

function chinaNow() {
  return new Date(Date.now() + 8 * 60 * 60 * 1000);
}

function ymd(year: number, monthIndex: number, day: number) {
  return `${year}-${String(monthIndex + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function monthRange(query: string) {
  const now = chinaNow();
  let year = now.getUTCFullYear();
  let month = now.getUTCMonth();
  if (/下个月/.test(query)) {
    month += 1;
    if (month > 11) { month = 0; year += 1; }
  } else {
    const explicit = query.match(/(?:(20\d{2})年)?(1[0-2]|0?[1-9])月/);
    if (!explicit) return null;
    if (explicit[1]) year = Number(explicit[1]);
    month = Number(explicit[2]) - 1;
  }
  const lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  return { event_date_from: ymd(year, month, 1), event_date_to: ymd(year, month, lastDay) };
}

function deriveFilter(query: string, labels: unknown) {
  const normalizedLabels = Array.isArray(labels) ? new Set(labels.filter((item) => typeof item === 'string')) : new Set<string>();
  const filter: Record<string, string> = {};
  if (normalizedLabels.has('ai') && normalizedLabels.has('web3')) filter.category = 'AI+Web3';
  else if (normalizedLabels.has('ai')) filter.category = 'AI';
  else if (normalizedLabels.has('web3')) filter.category = 'Web3';

  const eventTypes = ['黑客松', '分享会', '讲座', '竞赛', '研讨会', '论坛', '工作坊'];
  const eventType = eventTypes.find((item) => query.includes(item));
  if (eventType) filter.event_type = eventType;
  if (/(评分最高|最高分|最热门)/.test(query)) filter.ordering = '-score';
  else if (/(最近|近期|upcoming)/i.test(query)) filter.ordering = 'event_date';

  const range = monthRange(query);
  if (range) Object.assign(filter, range);

  const search = query
    .replace(/下个月|最近|近期|upcoming|评分最高|最高分|最热门/gi, ' ')
    .replace(/AI\+Web3|AI|Web3|人工智能|区块链/gi, ' ')
    .replace(new RegExp(eventTypes.join('|'), 'g'), ' ')
    .replace(/(?:(?:20\d{2})年)?(?:1[0-2]|0?[1-9])月/g, ' ')
    .replace(/的|活动|找|筛选|看看|请问/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (search) filter.search = search;
  return filter;
}

export async function POST(request: Request) {
  if (request.headers.get('content-type')?.split(';')[0].trim() !== 'application/json') {
    return Response.json({ error: 'unsupported_media_type' }, { status: 415 });
  }
  let body: { query?: string };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'invalid_json' }, { status: 400 });
  }
  const query = (body.query || '').trim();
  if (!query || query.length > 500) return Response.json({ error: 'invalid_query' }, { status: 400 });

  const sourceId = `filter-query:${createHash('sha256').update(query).digest('hex').slice(0, 16)}`;
  const execution = await runAgentTaskWithTrace({
    task: 'classify',
    input: { text: query, sourceIds: [sourceId] },
  });
  const filter = deriveFilter(query, execution.result.labels);
  if (Object.keys(filter).length === 0) filter.search = query;

  return Response.json({
    filter,
    reasoning: execution.trace.outcome === 'known'
      ? `统一 Agent 已解析筛选条件（${execution.trace.provider}）`
      : '证据不足，已安全降级为确定性关键词筛选',
    trace: {
      traceId: execution.trace.traceId,
      schemaVersion: execution.trace.schemaVersion,
      modelVersion: execution.trace.modelVersion,
      provider: execution.trace.provider,
      cacheHit: execution.trace.cacheHit,
      latencyMs: execution.trace.latencyMs,
      costMicrousd: execution.trace.incrementalCostMicrousd,
      externalSideEffect: false,
    },
  }, { headers: { 'cache-control': 'no-store' } });
}
