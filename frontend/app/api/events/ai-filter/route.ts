/**
 * AI 自然语言筛选解析
 *
 * POST /api/events/ai-filter
 * Body: { query: string }
 * Response: { filter: EventsFilter, reasoning: string }
 *
 * 使用 DeepSeek function calling 将用户自然语言解析为结构化筛选参数。
 * 例如："北大下个月的AI黑客松" → { search: "北大", category: "AI", event_type: "黑客松", event_date_from: "2026-08-01", event_date_to: "2026-08-31" }
 */

export const runtime = 'nodejs';

const DEEPSEEK_BASE_URL = process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com';
const DEEPSEEK_MODEL = process.env.DEEPSEEK_MODEL || 'deepseek-chat';

const FILTER_TOOL = {
  type: 'function' as const,
  function: {
    name: 'set_filters',
    description: '将用户的自然语言筛选需求解析为结构化筛选参数。如果用户没有指定某个维度，该字段留空字符串。',
    parameters: {
      type: 'object' as const,
      properties: {
        search: {
          type: 'string',
          description: '从用户描述中提取的搜索关键词，如高校名称、活动标题关键词等。例如"北大"、"清华"、"区块链"',
        },
        category: {
          type: 'string',
          enum: ['', 'AI', 'Web3', 'AI+Web3'],
          description: '活动分类。AI=人工智能相关，Web3=区块链/Web3相关，AI+Web3=AI与Web3结合。无法判断时留空',
        },
        event_type: {
          type: 'string',
          enum: ['', '黑客松', '分享会', '讲座', '竞赛', '研讨会', '论坛', '工作坊', '其他'],
          description: '活动类型。无法判断时留空',
        },
        ordering: {
          type: 'string',
          enum: ['', '-event_date', 'event_date', '-created_at', '-score'],
          description: '排序方式。-event_date=活动日期降序(最近的在前)，event_date=活动日期升序，-created_at=最新收录，-score=评分最高。默认留空表示不改变当前排序',
        },
        event_date_from: {
          type: 'string',
          description: '活动开始日期筛选（YYYY-MM-DD格式）。如"下个月"应对应下个月的第一天。"最近"应对应今天。无法判断时留空',
        },
        event_date_to: {
          type: 'string',
          description: '活动结束日期筛选（YYYY-MM-DD格式）。如"下个月"应对应下个月的最后一天。无法判断时留空',
        },
        reasoning: {
          type: 'string',
          description: '用中文简要说明解析逻辑，不超过30字。例如："筛选北大下个月的AI黑客松活动"',
        },
      },
      required: ['reasoning'],
    },
  },
};

function todayInChina(): string {
  // 使用 UTC+8 时区
  const now = new Date();
  const china = new Date(now.getTime() + 8 * 60 * 60 * 1000);
  return china.toISOString().split('T')[0];
}

function chinaDateString(): string {
  const now = new Date();
  const china = new Date(now.getTime() + 8 * 60 * 60 * 1000);
  const y = china.getUTCFullYear();
  const m = String(china.getUTCMonth() + 1).padStart(2, '0');
  const d = String(china.getUTCDate()).padStart(2, '0');
  const weekdays = ['日', '一', '二', '三', '四', '五', '六'];
  const wd = weekdays[china.getUTCDay()];
  return `${y}年${m}月${d}日 星期${wd}`;
}

export async function POST(request: Request) {
  // 验证 Content-Type
  const contentType = request.headers.get('content-type')?.split(';')[0].trim();
  if (contentType !== 'application/json') {
    return Response.json({ error: 'unsupported_media_type' }, { status: 415 });
  }

  // 解析请求体
  let body: { query?: string };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'invalid_json' }, { status: 400 });
  }

  const query = (body.query || '').trim();
  if (!query) {
    return Response.json({ error: 'empty_query' }, { status: 400 });
  }

  // 检查 API Key
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) {
    return Response.json(
      { error: 'ai_unavailable', message: 'AI 服务未配置，请设置 DEEPSEEK_API_KEY 环境变量' },
      { status: 503 },
    );
  }

  const today = todayInChina();
  const dateStr = chinaDateString();

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30_000);

  try {
    const upstream = await fetch(`${DEEPSEEK_BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: DEEPSEEK_MODEL,
        messages: [
          {
            role: 'system',
            content: `你是一个高校活动筛选助手。用户会用自然语言描述他们想找的活动，你需要将描述解析为结构化的筛选参数。

今天是 ${dateStr}（对应日期：${today}）。

可用的筛选维度：
- search: 搜索关键词（高校名称、活动标题等）
- category: AI / Web3 / AI+Web3
- event_type: 黑客松 / 分享会 / 讲座 / 竞赛 / 研讨会 / 论坛 / 工作坊 / 其他
- ordering: -event_date(最近活动) / event_date(最早活动) / -created_at(最新收录) / -score(评分最高)
- event_date_from / event_date_to: YYYY-MM-DD 格式的日期范围

注意：
- 如果用户说"最近"、"近期"、" upcoming"，不需要设置日期范围，使用默认排序即可
- 如果用户说"下个月"、"8月"等，需要将日期范围设置为对应的月份
- 如果用户说"评分最高"、"最热门的"，设置 ordering 为 -score
- 提取高校名称或活动标题关键词到 search 字段
- 如果用户没有明确指定某个维度，该字段留空`,
          },
          {
            role: 'user',
            content: query,
          },
        ],
        tools: [FILTER_TOOL],
        tool_choice: 'auto',
        stream: false,
        temperature: 0.1,
        max_tokens: 600,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!upstream.ok) {
      console.error(`[ai-filter] DeepSeek API error: ${upstream.status}`);
      return Response.json(
        { error: 'ai_error', message: 'AI 服务暂时不可用，请稍后重试' },
        { status: 502 },
      );
    }

    const payload = await upstream.json();
    const message = payload?.choices?.[0]?.message;

    if (!message) {
      return Response.json(
        { error: 'ai_error', message: 'AI 返回结果异常' },
        { status: 502 },
      );
    }

    // 优先使用 tool_calls 结果
    if (message.tool_calls && message.tool_calls.length > 0) {
      const args = message.tool_calls[0].function?.arguments;
      if (args) {
        let parsed: Record<string, string>;
        try {
          parsed = typeof args === 'string' ? JSON.parse(args) : args;
        } catch {
          // 如果 JSON 解析失败，使用文本内容作为回退
          return Response.json({
            filter: { search: query },
            reasoning: 'AI 解析结果异常，已使用原始关键词搜索',
          });
        }

        const filter: Record<string, string> = {};
        if (parsed.search) filter.search = parsed.search;
        if (parsed.category) filter.category = parsed.category;
        if (parsed.event_type) filter.event_type = parsed.event_type;
        if (parsed.ordering) filter.ordering = parsed.ordering;
        if (parsed.event_date_from) filter.event_date_from = parsed.event_date_from;
        if (parsed.event_date_to) filter.event_date_to = parsed.event_date_to;

        return Response.json({
          filter,
          reasoning: parsed.reasoning || `已解析筛选条件："${query}"`,
        });
      }
    }

    // 回退：使用文本内容
    return Response.json({
      filter: { search: query },
      reasoning: 'AI 未能解析结构化筛选条件，已使用原始关键词搜索',
    });
  } catch (err) {
    clearTimeout(timeout);
    console.error('[ai-filter] request failed:', err);
    return Response.json(
      { error: 'ai_error', message: 'AI 请求超时或网络异常，请稍后重试' },
      { status: 502 },
    );
  }
}
