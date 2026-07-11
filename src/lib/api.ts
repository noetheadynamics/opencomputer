import type { Provider } from "./providers";
import { PHAOS_BASE } from "./config";

export function debounce<T extends (...args: never[]) => void>(fn: T, ms: number): (...args: Parameters<T>) => void {
  let timer: ReturnType<typeof setTimeout>;
  return (...args: Parameters<T>) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), ms);
  };
}

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface TestResult {
  ok: boolean;
  message: string;
}

function normalizeBaseUrl(baseUrl: string): string {
  return baseUrl.replace(/\/+$/, "");
}

/** Ping the provider. Tries GET /models, falls back to a minimal completion. */
export async function testConnection(provider: Provider): Promise<TestResult> {
  const url = `${normalizeBaseUrl(provider.baseUrl)}/models`;
  const headers: Record<string, string> = {
    Authorization: `Bearer ${provider.apiKey}`,
  };
  try {
    const res = await fetch(url, { method: "GET", headers });
    if (res.ok) {
      return { ok: true, message: "Connection successful" };
    }
    // Some providers do not expose /models — try a tiny chat completion.
    if (res.status === 401 || res.status === 403) {
      return { ok: false, message: `Auth failed (${res.status})` };
    }
    const chatRes = await fetch(
      `${normalizeBaseUrl(provider.baseUrl)}/chat/completions`,
      {
        method: "POST",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: provider.model,
          messages: [{ role: "user", content: "ping" }],
          max_tokens: 1,
          stream: false,
        }),
      },
    );
    if (chatRes.ok) {
      return { ok: true, message: "Connection successful" };
    }
    return { ok: false, message: `Endpoint returned ${chatRes.status}` };
  } catch (err) {
    return {
      ok: false,
      message: err instanceof Error ? err.message : "Network error",
    };
  }
}

export interface StreamHandlers {
  onToken: (delta: string) => void;
  onDone: (full: string) => void;
  onError: (message: string) => void;
}

/** Stream a chat completion. Gracefully falls back to non-streamed JSON. */
export async function streamChat(
  provider: Provider,
  messages: ChatMessage[],
  handlers: StreamHandlers,
): Promise<void> {
  const url = `${normalizeBaseUrl(provider.baseUrl)}/chat/completions`;
  const headers: Record<string, string> = {
    Authorization: `Bearer ${provider.apiKey}`,
    "Content-Type": "application/json",
  };
  try {
    const res = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify({
        model: provider.model,
        messages,
        stream: true,
      }),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      handlers.onError(`Provider returned ${res.status}: ${text.slice(0, 200)}`);
      return;
    }

    const contentType = res.headers.get("content-type") ?? "";
    if (!contentType.includes("text/event-stream") || !res.body) {
      // Non-streaming fallback
      const data = await res.json();
      const content: string =
        data?.choices?.[0]?.message?.content ??
        data?.choices?.[0]?.text ??
        "";
      handlers.onToken(content);
      handlers.onDone(content);
      return;
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let full = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed.startsWith("data:")) continue;
        const payload = trimmed.slice(5).trim();
        if (payload === "[DONE]") continue;
        try {
          const json = JSON.parse(payload);
          const delta: string = json.choices?.[0]?.delta?.content ?? "";
          if (delta) {
            full += delta;
            handlers.onToken(delta);
          }
        } catch {
          // ignore partial/keepalive lines
        }
      }
    }
    handlers.onDone(full);
  } catch (err) {
    handlers.onError(err instanceof Error ? err.message : "Network error");
  }
}

export interface ToolCallInfo {
  id: string;
  name: string;
  args: Record<string, unknown>;
}

export interface ToolResultInfo {
  id: string;
  name: string;
  result: string;
}

export interface PhaosStreamHandlers {
  onToken: (delta: string) => void;
  onToolCall: (call: ToolCallInfo) => void;
  onToolResult: (result: ToolResultInfo) => void;
  onDone: (full: string) => void;
  onError: (message: string) => void;
}

/** Stream a chat through the PHAOS backend with tool execution. */
export async function streamPhaosChat(
  provider: Provider,
  messages: ChatMessage[],
  handlers: PhaosStreamHandlers,
  systemPrompt?: string,
  signal?: AbortSignal,
): Promise<void> {
  try {
    const res = await fetch(`${PHAOS_BASE}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        messages,
        provider: {
          baseUrl: provider.baseUrl,
          apiKey: provider.apiKey,
          model: provider.model,
        },
        system_prompt: systemPrompt || undefined,
      }),
      signal,
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      handlers.onError(`PHAOS returned ${res.status}: ${text.slice(0, 200)}`);
      return;
    }

    const reader = res.body?.getReader();
    if (!reader) {
      handlers.onError("No response body");
      return;
    }

    const decoder = new TextDecoder();
    let buffer = "";
    let full = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed.startsWith("data: ")) continue;
        const payload = trimmed.slice(6);
        try {
          const event = JSON.parse(payload);

          if (event.token) {
            full += event.token;
            handlers.onToken(event.token);
          }
          if (event.tool_call) {
            handlers.onToolCall(event.tool_call);
          }
          if (event.tool_result) {
            handlers.onToolResult(event.tool_result);
          }
          if (event.error) {
            handlers.onError(event.error);
            return;
          }
          if (event.done) {
            handlers.onDone(event.full_response || full);
            return;
          }
        } catch {
          // ignore partial lines
        }
      }
    }
    handlers.onDone(full);
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") {
      handlers.onDone("");
      return;
    }
    handlers.onError(err instanceof Error ? err.message : "Network error");
  }
}
