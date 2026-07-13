import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { ChatView } from "@/components/ChatView";
import { chatCache } from "@/lib/chatCache";
import type { Provider } from "@/lib/providers";
import type { Conversation, UIMessage } from "@/types/conversation";

const provider: Provider = {
  id: "p1",
  label: "Test",
  baseUrl: "http://localhost:8000/v1",
  apiKey: "k",
  model: "m",
};

function makeMsg(id: string, content: string): UIMessage {
  return { id, role: "user", content, timestamp: Date.now(), saved: true };
}

function baseProps(convId: string): React.ComponentProps<typeof ChatView> {
  const conv: Conversation = { id: convId, title: "t", created_at: new Date().toISOString() };
  return {
    provider,
    onOpenSettings: () => {},
    conversations: [conv],
    activeConvId: convId,
    onCreateConversation: async () => conv,
    onRemoveConversation: async () => {},
    onSelectConversation: () => {},
  };
}

describe("chatCache restore on remount", () => {
  beforeEach(() => {
    localStorage.clear();
    chatCache.clear();
    vi.restoreAllMocks();
  });

  it("restores messages from cache on remount without refetching", async () => {
    const convId = "conv-cache-1";
    const seed = [makeMsg("m1", "Hello from before")];
    chatCache.set(convId, seed);

    let getCalls = 0;
    global.fetch = vi.fn(async (url: string | Request) => {
      const u = String(url);
      if (u.includes(`/api/conversations/${convId}`)) {
        getCalls += 1;
        return {
          ok: true,
          status: 200,
          headers: new Headers(),
          json: async () => ({ id: convId, title: "t", messages: [], created_at: new Date().toISOString() }),
          text: async () => "",
        } as unknown as Response;
      }
      return {
        ok: true,
        status: 200,
        headers: new Headers(),
        json: async () => ({}),
        text: async () => "",
      } as unknown as Response;
    }) as unknown as typeof fetch;

    const props = baseProps(convId);

    const { unmount } = render(<ChatView {...props} />);
    // First mount: cache hit, no network fetch
    expect(getCalls).toBe(0);
    expect(await screen.findByText("Hello from before")).toBeInTheDocument();

    unmount();
    render(<ChatView {...props} />);
    // Remount: still cache hit, still no refetch
    expect(getCalls).toBe(0);
    expect(await screen.findByText("Hello from before")).toBeInTheDocument();
  });

  it("falls back to fetch when cache is empty", async () => {
    const convId = "conv-cache-2";
    let getCalls = 0;
    global.fetch = vi.fn(async (url: string | Request) => {
      const u = String(url);
      if (u.includes(`/api/conversations/${convId}`)) {
        getCalls += 1;
        return {
          ok: true,
          status: 200,
          headers: new Headers(),
          json: async () => ({
            id: convId,
            title: "t",
            messages: [{ id: "m2", role: "user", content: "From server", created_at: new Date().toISOString() }],
            created_at: new Date().toISOString(),
          }),
          text: async () => "",
        } as unknown as Response;
      }
      return {
        ok: true,
        status: 200,
        headers: new Headers(),
        json: async () => ({}),
        text: async () => "",
      } as unknown as Response;
    }) as unknown as typeof fetch;

    render(<ChatView {...baseProps(convId)} />);
    expect(await screen.findByText("From server")).toBeInTheDocument();
    expect(getCalls).toBe(1);
  });
});
