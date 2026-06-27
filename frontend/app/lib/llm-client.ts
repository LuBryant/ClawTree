/**
 * Browser-side DeepSeek streaming chat client.
 * Adapted from AgentBL's public/llm-client.js for Next.js/TypeScript.
 */
const DEEPSEEK_CONFIG = {
  API_KEY: 'sk-64b841c7f169475eaf8e469c9ddb1c7f',
  BASE_URL: 'https://api.deepseek.com',
  MODEL: 'deepseek-chat',
  TIMEOUT_MS: 60000,
};

interface ToolCall {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
}

interface StreamResult {
  content: string | null;
  tool_calls: ToolCall[] | null;
}

interface ToolDef {
  name: string;
  description: string;
  parameters: {
    type: 'object';
    properties: Record<string, unknown>;
    required?: string[];
  };
}

function uid() {
  return `${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

class DeepSeekClient {
  private apiKey: string;
  private baseUrl: string;
  private model: string;
  private timeout: number;

  constructor(config?: Partial<typeof DEEPSEEK_CONFIG>) {
    this.apiKey = config?.API_KEY ?? DEEPSEEK_CONFIG.API_KEY;
    this.baseUrl = config?.BASE_URL ?? DEEPSEEK_CONFIG.BASE_URL;
    this.model = config?.MODEL ?? DEEPSEEK_CONFIG.MODEL;
    this.timeout = config?.TIMEOUT_MS ?? DEEPSEEK_CONFIG.TIMEOUT_MS;
  }

  /** Streaming chat with Function Calling support. */
  async streamChat(
    messages: Array<{ role: string; content: string | null; tool_calls?: unknown; tool_call_id?: string }>,
    tools?: ToolDef[],
    callbacks?: {
      onChunk?: (text: string) => void;
      onToolCall?: (tc: { name: string; args: string; id: string; partial: boolean }) => void;
    },
  ): Promise<StreamResult> {
    const body: Record<string, unknown> = {
      model: this.model,
      messages,
      stream: true,
      temperature: 0.3,
      max_tokens: 2048,
    };

    if (tools?.length) {
      body.tools = tools.map((t) => ({
        type: 'function',
        function: {
          name: t.name,
          description: t.description,
          parameters: t.parameters,
        },
      }));
      body.tool_choice = 'auto';
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeout);

    try {
      const response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      if (!response.ok) {
        const text = await response.text().catch(() => '');
        throw new Error(`DeepSeek HTTP ${response.status}: ${text.slice(0, 300)}`);
      }

      const reader = response.body!.getReader();
      const decoder = new TextDecoder();
      let content = '';
      const toolCallMap: Record<number, { id: string; name: string; arguments: string }> = {};

      let buf = '';
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const lines = buf.split('\n');
        buf = lines.pop() || '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || !trimmed.startsWith('data:')) continue;
          const dataStr = trimmed.slice(5).trim();
          if (dataStr === '[DONE]') continue;

          try {
            const parsed = JSON.parse(dataStr);
            const delta = parsed.choices?.[0]?.delta;
            if (!delta) continue;

            if (delta.content) {
              content += delta.content;
              callbacks?.onChunk?.(delta.content);
            }

            if (delta.tool_calls) {
              for (const tc of delta.tool_calls) {
                const idx = tc.index ?? 0;
                if (!toolCallMap[idx]) {
                  toolCallMap[idx] = { id: tc.id || uid(), name: tc.function?.name || '', arguments: '' };
                }
                if (tc.id) toolCallMap[idx].id = tc.id;
                if (tc.function?.name) toolCallMap[idx].name = tc.function.name;
                if (tc.function?.arguments) toolCallMap[idx].arguments += tc.function.arguments;
                callbacks?.onToolCall?.({
                  name: toolCallMap[idx].name,
                  args: toolCallMap[idx].arguments,
                  id: toolCallMap[idx].id,
                  partial: true,
                });
              }
            }
          } catch { /* skip unparseable line */ }
        }
      }

      const indexes = Object.keys(toolCallMap).sort((a, b) => Number(a) - Number(b));
      const toolCalls: ToolCall[] = indexes.map((i) => {
        const tc = toolCallMap[Number(i)];
        let args: Record<string, unknown> = {};
        try { args = tc.arguments ? JSON.parse(tc.arguments) : {}; } catch { args = { _raw: tc.arguments }; }
        return { id: tc.id, name: tc.name, arguments: args };
      });

      return { content: content || null, tool_calls: toolCalls.length > 0 ? toolCalls : null };
    } finally {
      clearTimeout(timer);
    }
  }
}

let _instance: DeepSeekClient | null = null;
export function getDeepSeekClient() {
  if (!_instance) _instance = new DeepSeekClient();
  return _instance;
}

export type { ToolCall, StreamResult, ToolDef };
