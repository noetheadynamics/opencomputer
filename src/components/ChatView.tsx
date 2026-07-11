import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Send, Bot, User, PlugZap } from "lucide-react";
import { streamChat, type ChatMessage } from "@/lib/api";
import type { Provider } from "@/lib/providers";
import { cn } from "@/lib/utils";

interface ChatViewProps {
  provider: Provider | null;
  onOpenSettings: () => void;
}

interface UIMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  streaming?: boolean;
}

function uid() {
  return Math.random().toString(36).slice(2);
}

const glassSpring = {
  type: "spring" as const,
  stiffness: 500,
  damping: 25,
  mass: 0.5,
};

const tapSpring = {
  type: "spring" as const,
  stiffness: 700,
  damping: 20,
  mass: 0.4,
};

export function ChatView({ provider, onOpenSettings }: ChatViewProps) {
  const [messages, setMessages] = React.useState<UIMessage[]>([]);
  const [input, setInput] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const scrollRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    scrollRef.current?.scrollTo?.({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages]);

  const send = React.useCallback(async () => {
    const text = input.trim();
    if (!text || !provider || busy) return;
    setInput("");
    const userMsg: UIMessage = { id: uid(), role: "user", content: text };
    const assistantId = uid();
    const assistantMsg: UIMessage = {
      id: assistantId,
      role: "assistant",
      content: "",
      streaming: true,
    };
    setMessages((m) => [...m, userMsg, assistantMsg]);
    setBusy(true);

    const history: ChatMessage[] = [
      ...messages.map((m) => ({ role: m.role, content: m.content })),
      { role: "user" as const, content: text },
    ];

    await streamChat(provider, history, {
      onToken: (delta) =>
        setMessages((m) =>
          m.map((msg) =>
            msg.id === assistantId
              ? { ...msg, content: msg.content + delta }
              : msg,
          ),
        ),
      onDone: () =>
        setMessages((m) =>
          m.map((msg) =>
            msg.id === assistantId ? { ...msg, streaming: false } : msg,
          ),
        ),
      onError: (message) =>
        setMessages((m) =>
          m.map((msg) =>
            msg.id === assistantId
              ? {
                  ...msg,
                  streaming: false,
                  content: `⚠️ ${message}`,
                }
              : msg,
          ),
        ),
    });
    setBusy(false);
  }, [input, provider, busy, messages]);

  if (!provider) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4 p-8 text-center">
        <div className="oc-glass-3d flex h-16 w-16 items-center justify-center rounded-2xl text-oc-accent">
          <PlugZap size={28} />
        </div>
        <div>
          <h2 className="text-lg font-semibold text-oc-text-primary">
            No provider configured
          </h2>
          <p className="mt-1 max-w-sm text-sm text-oc-text-secondary">
            Add an OpenAI-compatible provider in Settings to start chatting.
          </p>
        </div>
        <motion.button
          type="button"
          whileHover={{ scale: 1.05, y: -2, transition: glassSpring }}
          whileTap={{ scale: 0.92, y: 1, transition: tapSpring }}
          onClick={onOpenSettings}
          className="oc-glass-btn oc-glass-btn-primary rounded-xl px-4 py-2 text-sm font-medium"
        >
          Open Settings
        </motion.button>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <div
        ref={scrollRef}
        className="flex-1 space-y-4 overflow-y-auto px-4 py-6 md:px-10"
      >
        {messages.length === 0 && (
          <div className="flex h-full flex-col items-center justify-center text-center">
            <div className="oc-glass-3d flex h-14 w-14 items-center justify-center rounded-2xl text-oc-accent">
              <Bot size={26} />
            </div>
            <p className="mt-3 text-sm text-oc-text-secondary">
              Chatting with{" "}
              <span className="text-oc-text-primary">{provider.label}</span> ·{" "}
              <span className="text-oc-text-primary">{provider.model}</span>
            </p>
          </div>
        )}
        <AnimatePresence initial={false}>
          {messages.map((msg) => (
            <motion.div
              key={msg.id}
              initial={{ opacity: 0, y: 12, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ type: "spring", stiffness: 380, damping: 30 }}
              className={cn(
                "flex items-end gap-2",
                msg.role === "user" ? "justify-end" : "justify-start",
              )}
            >
              {msg.role === "assistant" && (
                <div className="mb-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-oc-accent/15 text-oc-accent">
                  <Bot size={15} />
                </div>
              )}
              <div
                className={cn(
                  "max-w-[75%] whitespace-pre-wrap px-4 py-2.5 text-sm leading-relaxed",
                  msg.role === "user"
                    ? "oc-glass-btn-primary rounded-2xl text-[#04140d]"
                    : "oc-glass-3d rounded-2xl text-oc-text-primary",
                )}
              >
                {msg.content || (msg.streaming ? "…" : "")}
                {msg.streaming && msg.content && (
                  <span className="ml-0.5 inline-block h-3 w-1.5 animate-pulse bg-oc-accent align-middle" />
                )}
              </div>
              {msg.role === "user" && (
                <div className="mb-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-oc-bezel text-oc-text-primary">
                  <User size={15} />
                </div>
              )}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      <div className="shrink-0 px-4 py-3 md:px-6">
        <div className="flex items-end gap-2">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send();
              }
            }}
            rows={1}
            placeholder={`Message ${provider.label}…`}
            className="oc-glass-input max-h-40 min-h-[42px] flex-1 resize-none px-3 py-2.5 text-sm text-oc-text-primary placeholder:text-oc-text-secondary/60 outline-none"
          />
          <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.9 }}>
            <motion.button
              type="button"
              onClick={send}
              disabled={busy || !input.trim()}
              whileHover={{ scale: 1.05, y: -2, transition: glassSpring }}
              whileTap={{ scale: 0.9, y: 1, transition: tapSpring }}
              className="oc-glass-btn oc-glass-btn-primary flex h-[42px] w-[42px] items-center justify-center rounded-xl"
              aria-label="Send"
            >
              <Send size={18} />
            </motion.button>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
