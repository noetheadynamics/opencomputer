import type { Provider } from "./providers";

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
