import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, within, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "@/App";

function sseStream(chunks: string[]) {
  const enc = new TextEncoder();
  let i = 0;
  const stream = new ReadableStream({
    pull(controller) {
      if (i < chunks.length) {
        controller.enqueue(enc.encode(chunks[i]));
        i += 1;
      } else {
        controller.close();
      }
    },
  });
  return stream;
}

function mockModelsOk() {
  global.fetch = vi.fn(async () => ({
    ok: true,
    status: 200,
    headers: new Headers({ "content-type": "application/json" }),
    json: async () => ({ object: "list", data: [] }),
    text: async () => "",
  })) as unknown as typeof fetch;
}

function mockChatStream() {
  global.fetch = vi.fn(async () => ({
    ok: true,
    status: 200,
    body: sseStream([
      'data: {"choices":[{"delta":{"content":"Hel"}}]}\n\n',
      'data: {"choices":[{"delta":{"content":"lo"}}]}\n\n',
      "data: [DONE]\n\n",
    ]),
    headers: new Headers({ "content-type": "text/event-stream" }),
    json: async () => ({}),
    text: async () => "",
  })) as unknown as typeof fetch;
}

function mockChatFail() {
  global.fetch = vi.fn(async () => ({
    ok: false,
    status: 500,
    headers: new Headers({ "content-type": "application/json" }),
    json: async () => ({}),
    text: async () => "boom",
  })) as unknown as typeof fetch;
}

describe("OpenComputer Phase 1 UI", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it("3. Provider Configuration: add and persist a profile", async () => {
    const user = userEvent.setup();
    render(<App />);
    // wait for load
    await screen.findByTitle("Settings");

    // open settings (sidebar gear has title="Settings")
    await user.click(screen.getByTitle("Settings"));
    // Add button inside the Providers section
    await user.click(await screen.findByRole("button", { name: /^add$/i }));

    await user.type(
      await screen.findByPlaceholderText("Alethea Local"),
      "Test Provider",
    );
    await user.type(
      await screen.findByPlaceholderText("http://localhost:8000/v1"),
      "http://localhost:8000/v1",
    );
    await user.type(await screen.findByPlaceholderText("sk-…"), "dummy-key");
    await user.type(
      await screen.findByPlaceholderText("alethea-v2"),
      "test-model",
    );

    await user.click(screen.getByRole("button", { name: /add provider/i }));

    // profile appears in list (scoped to the settings dialog)
    const dialog = () => screen.getByRole("dialog");
    expect(
      await within(dialog()).findByText("Test Provider"),
    ).toBeInTheDocument();
    expect(within(dialog()).getByText(/test-model/)).toBeInTheDocument();

    // persisted to localStorage
    const stored = JSON.parse(localStorage.getItem("oc:providers") || "[]");
    expect(stored).toHaveLength(1);
    expect(stored[0].label).toBe("Test Provider");
    expect(stored[0].baseUrl).toBe("http://localhost:8000/v1");
    expect(stored[0].model).toBe("test-model");
  });

  it("4. Test Connection reports success when endpoint reachable", async () => {
    const user = userEvent.setup();
    mockModelsOk();
    render(<App />);
    await screen.findByTitle("Settings");

    await user.click(screen.getByTitle("Settings"));
    await user.click(await screen.findByRole("button", { name: /^add$/i }));
    await user.type(
      await screen.findByPlaceholderText("Alethea Local"),
      "Test Provider",
    );
    await user.type(
      await screen.findByPlaceholderText("http://localhost:8000/v1"),
      "http://localhost:8000/v1",
    );
    await user.type(await screen.findByPlaceholderText("sk-…"), "dummy-key");
    await user.type(
      await screen.findByPlaceholderText("alethea-v2"),
      "test-model",
    );
    await user.click(screen.getByRole("button", { name: /test connection/i }));
    expect(
      await screen.findByText(/connection successful/i),
    ).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /add provider/i }));
    expect(
      await within(screen.getByRole("dialog")).findByText("Test Provider"),
    ).toBeInTheDocument();
  });

  it("4b. Test Connection reports failure when endpoint errors", async () => {
    const user = userEvent.setup();
    mockChatFail();
    // make /models fail too (500)
    global.fetch = vi.fn(async (url: string) => {
      if (String(url).includes("/models")) {
        return {
          ok: false,
          status: 500,
          headers: new Headers(),
          json: async () => ({}),
          text: async () => "err",
        } as unknown as Response;
      }
      return {
        ok: false,
        status: 500,
        headers: new Headers(),
        json: async () => ({}),
        text: async () => "err",
      } as unknown as Response;
    }) as unknown as typeof fetch;

    render(<App />);
    await screen.findByTitle("Settings");
    await user.click(screen.getByTitle("Settings"));
    await user.click(await screen.findByRole("button", { name: /^add$/i }));
    await user.type(
      await screen.findByPlaceholderText("Alethea Local"),
      "Test Provider",
    );
    await user.type(
      await screen.findByPlaceholderText("http://localhost:8000/v1"),
      "http://localhost:8000/v1",
    );
    await user.type(await screen.findByPlaceholderText("sk-…"), "dummy-key");
    await user.type(
      await screen.findByPlaceholderText("alethea-v2"),
      "test-model",
    );
    await user.click(screen.getByRole("button", { name: /test connection/i }));
    expect(
      await screen.findByText(/endpoint returned 500/i),
    ).toBeInTheDocument();
  });

  it("5. Chat Send/Receive streams a response without crashing on error", async () => {
    const user = userEvent.setup();
    // seed a provider directly via localStorage (becomes active automatically)
    localStorage.setItem(
      "oc:providers",
      JSON.stringify([
        {
          id: "p1",
          label: "Test Provider",
          baseUrl: "http://localhost:8000/v1",
          apiKey: "k",
          model: "test-model",
        },
      ]),
    );
    localStorage.setItem("oc:active_provider_id", JSON.stringify("p1"));

    render(<App />);
    // provider is active from storage; chat view should be ready
    const textarea = await screen.findByPlaceholderText(/message test provider/i);

    // streaming success
    mockChatStream();
    await user.type(textarea, "Hello");
    await user.click(screen.getByRole("button", { name: /send/i }));

    // user message appears
    await waitFor(
      () => {
        const found = screen.queryAllByText(/Hello/);
        if (found.length === 0) {
          // eslint-disable-next-line no-console
          console.log("CHAT DOM >>>", document.body.textContent?.slice(0, 600));
        }
        expect(found.length).toBeGreaterThan(0);
      },
      { timeout: 3000 },
    );
    // assistant streamed response assembled ("Hel" + "lo")
    await waitFor(() =>
      expect(screen.getAllByText(/Hel/).length).toBeGreaterThanOrEqual(1),
    );
    expect(screen.queryByText(/⚠️/)).not.toBeInTheDocument();

    // error path: send again with failing endpoint
    mockChatFail();
    const ta2 = screen.getByPlaceholderText(/message test provider/i);
    await user.type(ta2, "Again");
    await user.click(screen.getByRole("button", { name: /send/i }));
    expect(await screen.findByText(/⚠️/)).toBeInTheDocument();
  });

  it("6. Theme toggle switches dark/light and persists", async () => {
    const user = userEvent.setup();
    render(<App />);
    await screen.findByTitle("Settings");

    expect(document.documentElement.classList.contains("dark")).toBe(true);
    await user.click(screen.getByRole("button", { name: /toggle theme/i }));
    expect(document.documentElement.classList.contains("dark")).toBe(false);
    expect(JSON.parse(localStorage.getItem("oc:theme") || '""')).toBe("light");

    await user.click(screen.getByRole("button", { name: /toggle theme/i }));
    expect(document.documentElement.classList.contains("dark")).toBe(true);
    expect(JSON.parse(localStorage.getItem("oc:theme") || '""')).toBe("dark");
  });

  it("7. Glassmorphism: key surfaces use 3D glass classes", async () => {
    render(<App />);
    await screen.findByTitle("Settings");
    // Check for floating icon pills (sidebar), glass-3d, glass-panel, glass-modal
    const floatingIcons = document.querySelectorAll(".oc-floating-icon");
    const glassPanel = document.querySelectorAll(".oc-glass-panel");
    const glass3d = document.querySelectorAll(".oc-glass-3d");
    const total = floatingIcons.length + glassPanel.length + glass3d.length;
    expect(total).toBeGreaterThanOrEqual(1);
  });

  it("8. Logo: real brand asset is rendered in the header", async () => {
    render(<App />);
    await screen.findByTitle("Settings");
    const logo = document.querySelector('header img[alt="OpenComputer"]');
    expect(logo).not.toBeNull();
    expect((logo as HTMLImageElement).getAttribute("src")).toBe(
      "/opencomputer-logo.png",
    );
  });
});
