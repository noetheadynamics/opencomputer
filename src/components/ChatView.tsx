import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Send,
  Bot,
  User,
  PlugZap,
  Wrench,
  Paperclip,
} from "lucide-react";
import {
  streamPhaosChat,
  type ChatMessage,
  type ToolCallInfo,
  type ToolResultInfo,
} from "@/lib/api";
import type { Provider } from "@/lib/providers";
import { cn } from "@/lib/utils";
import type {
  ChatAttachment,
  ChatReaction,
  CommandItem,
} from "@/types/chat";
import { ReactionPicker } from "./chat/ReactionPicker";
import { ReplyIndicator } from "./chat/ReplyIndicator";
import { MessageEditor } from "./chat/MessageEditor";
import { AttachmentPreview } from "./chat/AttachmentPreview";
import { CommandPalette } from "./chat/CommandPalette";
import { FormattingToolbar } from "./chat/FormattingToolbar";
import { LinkPreview } from "./chat/LinkPreview";
import { MessageFeedback } from "./chat/MessageFeedback";
import { TypingIndicator } from "./chat/TypingIndicator";
import { ScrollToBottom } from "./chat/ScrollToBottom";
import { LongPressMenu } from "./chat/LongPressMenu";

interface ChatViewProps {
  provider: Provider | null;
  onOpenSettings: () => void;
  systemPrompt?: string;
}

interface UIMessage {
  id: string;
  role: "user" | "assistant" | "tool";
  content: string;
  streaming?: boolean;
  toolCall?: ToolCallInfo;
  toolResult?: ToolResultInfo;
  reactions?: ChatReaction[];
  replyTo?: string;
  attachments?: ChatAttachment[];
  isEdited?: boolean;
  timestamp: number;
}

function uid() {
  return Math.random().toString(36).slice(2);
}

function extractUrls(text: string): string[] {
  const urlRegex = /https?:\/\/[^\s]+/g;
  return text.match(urlRegex) ?? [];
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

export function ChatView({ provider, onOpenSettings, systemPrompt }: ChatViewProps) {
  const [messages, setMessages] = React.useState<UIMessage[]>([]);
  const [input, setInput] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const scrollRef = React.useRef<HTMLDivElement>(null);
  const inputRef = React.useRef<HTMLTextAreaElement>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  // Sub-feature state
  const [replyTo, setReplyTo] = React.useState<UIMessage | null>(null);
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [longPressMsg, setLongPressMsg] = React.useState<UIMessage | null>(null);
  const [showCommandPalette, setShowCommandPalette] = React.useState(false);
  const [commandFilter, setCommandFilter] = React.useState("");
  const [attachments, setAttachments] = React.useState<ChatAttachment[]>([]);
  const [showScrollBtn, setShowScrollBtn] = React.useState(false);
  const [reactionPickerMsgId, setReactionPickerMsgId] = React.useState<string | null>(null);

  React.useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const handleScroll = () => {
      const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 100;
      setShowScrollBtn(!atBottom);
    };
    el.addEventListener("scroll", handleScroll);
    return () => el.removeEventListener("scroll", handleScroll);
  }, []);

  React.useEffect(() => {
    if (!showScrollBtn) {
      scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
    }
  }, [messages, showScrollBtn]);

  // Detect / commands
  React.useEffect(() => {
    if (input.startsWith("/") && input.length < 20) {
      setShowCommandPalette(true);
      setCommandFilter(input);
    } else {
      setShowCommandPalette(false);
    }
  }, [input]);

  function handleCommandSelect(cmd: CommandItem) {
    setShowCommandPalette(false);
    if (cmd.handler === "clear") {
      setMessages([]);
      setInput("");
      return;
    }
    if (cmd.handler === "file") {
      fileInputRef.current?.click();
      setInput("");
      return;
    }
    setInput(`/${cmd.handler} `);
    inputRef.current?.focus();
  }

  function handleFileAttach(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files) return;
    const newAttachments: ChatAttachment[] = Array.from(files).map((f) => ({
      id: uid(),
      name: f.name,
      type: f.type.startsWith("image/") ? "image" : f.type.includes("pdf") ? "document" : "file",
      size: f.size,
      url: URL.createObjectURL(f),
      mimeType: f.type,
    }));
    setAttachments((prev) => [...prev, ...newAttachments]);
    e.target.value = "";
  }

  function handleFormat(prefix: string, suffix: string) {
    const el = inputRef.current;
    if (!el) return;
    const start = el.selectionStart;
    const end = el.selectionEnd;
    const selected = input.slice(start, end);
    const newVal = input.slice(0, start) + prefix + selected + suffix + input.slice(end);
    setInput(newVal);
    setTimeout(() => {
      el.focus();
      el.setSelectionRange(start + prefix.length, end + prefix.length);
    }, 0);
  }

  function handleReaction(msgId: string, emoji: string) {
    setMessages((msgs) =>
      msgs.map((m) => {
        if (m.id !== msgId) return m;
        const existing = m.reactions?.find((r) => r.emoji === emoji);
        if (existing) {
          return {
            ...m,
            reactions: (m.reactions ?? []).map((r) =>
              r.emoji === emoji ? { ...r, count: r.count + 1 } : r,
            ),
          };
        }
        return {
          ...m,
          reactions: [...(m.reactions ?? []), { emoji, count: 1, users: ["me"] }],
        };
      }),
    );
    setReactionPickerMsgId(null);
  }

  function handleEdit(msg: UIMessage) {
    setEditingId(msg.id);
    setLongPressMsg(null);
  }

  function handleEditSave(msgId: string, newContent: string) {
    setMessages((msgs) =>
      msgs.map((m) => (m.id === msgId ? { ...m, content: newContent, isEdited: true } : m)),
    );
    setEditingId(null);
  }

  function handleDelete(msgId: string) {
    setMessages((msgs) => msgs.filter((m) => m.id !== msgId));
    setLongPressMsg(null);
  }

  function handleCopy(msg: UIMessage) {
    navigator.clipboard.writeText(msg.content);
    setLongPressMsg(null);
  }

  function handleReply(msg: UIMessage) {
    setReplyTo(msg);
    setLongPressMsg(null);
    inputRef.current?.focus();
  }

  const send = React.useCallback(async () => {
    const text = input.trim();
    if ((!text && attachments.length === 0) || !provider || busy) return;
    setInput("");
    setReplyTo(null);

    const userMsg: UIMessage = {
      id: uid(),
      role: "user",
      content: text,
      attachments: attachments.length > 0 ? [...attachments] : undefined,
      replyTo: replyTo?.id,
      timestamp: Date.now(),
    };
    setAttachments([]);

    const assistantId = uid();
    const assistantMsg: UIMessage = {
      id: assistantId,
      role: "assistant",
      content: "",
      streaming: true,
      timestamp: Date.now(),
    };
    setMessages((m) => [...m, userMsg, assistantMsg]);
    setBusy(true);

    const history: ChatMessage[] = [
      ...messages
        .filter((m) => m.role === "user" || m.role === "assistant")
        .map((m) => ({ role: m.role as "user" | "assistant", content: m.content })),
      { role: "user" as const, content: text },
    ];

    await streamPhaosChat(
      provider,
      history,
      {
        onToken: (delta) =>
          setMessages((m) =>
            m.map((msg) =>
              msg.id === assistantId ? { ...msg, content: msg.content + delta } : msg,
            ),
          ),
        onToolCall: (call) =>
          setMessages((m) => [
            ...m,
            { id: uid(), role: "tool" as const, content: "", toolCall: call, timestamp: Date.now() },
          ]),
        onToolResult: (result) =>
          setMessages((m) =>
            m.map((msg) =>
              msg.toolCall?.id === result.id ? { ...msg, toolResult: result } : msg,
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
                ? { ...msg, streaming: false, content: `⚠️ ${message}` }
                : msg,
            ),
          ),
      },
      systemPrompt || "You are a helpful AI assistant with access to tools. Use them when appropriate.",
    );
    setBusy(false);
  }, [input, provider, busy, messages, attachments, replyTo]);

  if (!provider) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4 p-8 text-center">
        <div className="oc-glass-3d flex h-16 w-16 items-center justify-center rounded-2xl text-oc-accent">
          <PlugZap size={28} />
        </div>
        <div>
          <h2 className="text-lg font-semibold text-oc-text-primary">No provider configured</h2>
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
      <input
        ref={fileInputRef}
        type="file"
        multiple
        className="hidden"
        onChange={handleFileAttach}
      />

      {/* Reply indicator */}
      {replyTo && (
        <ReplyIndicator replyTo={replyTo as never} onClose={() => setReplyTo(null)} />
      )}

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto px-4 py-6 md:px-10">
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
            >
              {msg.role === "tool" && msg.toolCall ? (
                <div className="flex items-start gap-2 pl-9">
                  <div className="oc-glass-3d max-w-[80%] rounded-xl px-3 py-2 text-xs">
                    <div className="flex items-center gap-1.5 text-oc-accent">
                      <Wrench size={12} />
                      <span className="font-medium">{msg.toolCall.name}</span>
                      {!msg.toolResult && (
                        <span className="animate-pulse text-oc-text-secondary">…</span>
                      )}
                    </div>
                    {msg.toolResult && (
                      <pre className="mt-1 max-h-32 overflow-auto text-oc-text-secondary whitespace-pre-wrap">
                        {msg.toolResult.result.slice(0, 300)}
                      </pre>
                    )}
                  </div>
                </div>
              ) : (
                <div
                  className={cn(
                    "group flex items-end gap-2",
                    msg.role === "user" ? "justify-end" : "justify-start",
                  )}
                  onContextMenu={(e) => {
                    e.preventDefault();
                    setLongPressMsg(msg);
                  }}
                >
                  {msg.role === "assistant" && (
                    <div className="mb-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-oc-accent/15 text-oc-accent">
                      <Bot size={15} />
                    </div>
                  )}

                  <div className="max-w-[75%]">
                    {/* Reply preview */}
                    {msg.replyTo && (
                      <div className="mb-1 text-xs text-oc-text-secondary italic truncate max-w-[200px]">
                        ↳ {messages.find((m) => m.id === msg.replyTo)?.content.slice(0, 50) ?? "…"}
                      </div>
                    )}

                    {/* Attachments */}
                    {msg.attachments && msg.attachments.length > 0 && (
                      <div className="mb-1 flex flex-wrap gap-1">
                        {msg.attachments.map((a) => (
                          <AttachmentPreview key={a.id} file={a} mini />
                        ))}
                      </div>
                    )}

                    {/* Message bubble */}
                    {editingId === msg.id ? (
                      <MessageEditor
                        content={msg.content}
                        onSave={(c) => handleEditSave(msg.id, c)}
                        onCancel={() => setEditingId(null)}
                      />
                    ) : (
                      <div
                        className={cn(
                          "relative whitespace-pre-wrap px-4 py-2.5 text-sm leading-relaxed",
                          msg.role === "user"
                            ? "oc-glass-btn-primary rounded-2xl text-[#04140d]"
                            : "oc-glass-3d rounded-2xl text-oc-text-primary",
                        )}
                      >
                        {msg.content || (msg.streaming ? "" : "")}
                        {msg.streaming && !msg.content && <TypingIndicator />}
                        {msg.streaming && msg.content && (
                          <span className="ml-0.5 inline-block h-3 w-1.5 animate-pulse bg-oc-accent align-middle" />
                        )}
                        {msg.isEdited && (
                          <span className="ml-1 text-[10px] text-oc-text-secondary">(edited)</span>
                        )}
                      </div>
                    )}

                    {/* Reactions */}
                    {msg.reactions && msg.reactions.length > 0 && (
                      <div className="mt-1 flex flex-wrap gap-1">
                        {msg.reactions.map((r) => (
                          <button
                            key={r.emoji}
                            type="button"
                            onClick={() => handleReaction(msg.id, r.emoji)}
                            className="oc-glass-3d rounded-full px-1.5 py-0.5 text-xs hover:scale-110 transition-transform"
                          >
                            {r.emoji} {r.count}
                          </button>
                        ))}
                        <button
                          type="button"
                          onClick={() => setReactionPickerMsgId(msg.id)}
                          className="oc-glass-3d rounded-full px-1.5 py-0.5 text-xs text-oc-text-secondary hover:text-oc-accent"
                        >
                          +
                        </button>
                      </div>
                    )}

                    {/* Link previews (for assistant messages with URLs) */}
                    {msg.role === "assistant" && !msg.streaming && extractUrls(msg.content).length > 0 && (
                      <div className="mt-2 space-y-2">
                        {extractUrls(msg.content).slice(0, 2).map((url) => (
                          <LinkPreview key={url} url={url} />
                        ))}
                      </div>
                    )}

                    {/* Feedback on assistant messages */}
                    {msg.role === "assistant" && !msg.streaming && msg.content && (
                      <MessageFeedback
                        messageId={msg.id}
                        query={messages.find((m) => m.role === "user")?.content ?? ""}
                        response={msg.content}
                      />
                    )}
                  </div>

                  {msg.role === "user" && (
                    <div className="mb-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-oc-bezel text-oc-text-primary">
                      <User size={15} />
                    </div>
                  )}

                  {/* Reaction button on hover */}
                  {msg.role === "assistant" && !msg.streaming && (
                    <button
                      type="button"
                      onClick={() => setReactionPickerMsgId(reactionPickerMsgId === msg.id ? null : msg.id)}
                      className="mb-1 opacity-0 group-hover:opacity-100 transition-opacity text-oc-text-secondary hover:text-oc-accent text-xs"
                    >
                      😊
                    </button>
                  )}
                </div>
              )}

              {/* Reaction picker popup */}
              {reactionPickerMsgId === msg.id && (
                <ReactionPicker
                  isOpen
                  onClose={() => setReactionPickerMsgId(null)}
                  onSelect={(emoji) => handleReaction(msg.id, emoji)}
                />
              )}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* Scroll to bottom */}
      <ScrollToBottom
        show={showScrollBtn}
        onClick={() => {
          scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
          setShowScrollBtn(false);
        }}
      />

      {/* Command palette */}
      {showCommandPalette && (
        <CommandPalette
          isOpen={showCommandPalette}
          onClose={() => setShowCommandPalette(false)}
          onSelect={handleCommandSelect}
          filter={commandFilter}
        />
      )}

      {/* Input area */}
      <div className="shrink-0 px-4 py-3 md:px-6">
        {/* Attachment previews */}
        {attachments.length > 0 && (
          <div className="mb-2 flex flex-wrap gap-2">
            {attachments.map((a) => (
              <AttachmentPreview
                key={a.id}
                file={a}
                onRemove={(id) => setAttachments((prev) => prev.filter((x) => x.id !== id))}
              />
            ))}
          </div>
        )}

        {/* Formatting toolbar */}
        <FormattingToolbar onFormat={handleFormat} />

        <div className="flex items-end gap-2">
          {/* Attach button */}
          <motion.button
            type="button"
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            onClick={() => fileInputRef.current?.click()}
            className="oc-glass-btn flex h-[42px] w-[42px] items-center justify-center rounded-xl text-oc-text-secondary hover:text-oc-accent"
            aria-label="Attach file"
          >
            <Paperclip size={18} />
          </motion.button>

          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send();
              }
              if (e.key === "Escape") {
                setShowCommandPalette(false);
                setReplyTo(null);
              }
            }}
            rows={1}
            placeholder={
              replyTo
                ? `Reply to "${replyTo.content.slice(0, 30)}…"`
                : `Message ${provider.label}…`
            }
            className="oc-glass-input max-h-40 min-h-[42px] flex-1 resize-none px-3 py-2.5 text-sm text-oc-text-primary placeholder:text-oc-text-secondary/60 outline-none"
          />
          <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.9 }}>
            <motion.button
              type="button"
              onClick={send}
              disabled={busy || (!input.trim() && attachments.length === 0)}
              whileHover={{ scale: 1.05, y: -2, transition: glassSpring }}
              whileTap={{ scale: 0.9, y: 1, transition: tapSpring }}
              className="oc-glass-btn oc-glass-btn-primary flex h-[42px] w-[42px] items-center justify-center rounded-xl disabled:opacity-40"
              aria-label="Send"
            >
              <Send size={18} />
            </motion.button>
          </motion.div>
        </div>
      </div>

      {/* Long press / context menu */}
      <LongPressMenu
        isOpen={!!longPressMsg}
        onClose={() => setLongPressMsg(null)}
        onCopy={() => longPressMsg && handleCopy(longPressMsg)}
        onReply={() => longPressMsg && handleReply(longPressMsg)}
        onEdit={() => longPressMsg && handleEdit(longPressMsg)}
        onDelete={() => longPressMsg && handleDelete(longPressMsg.id)}
        isUser={longPressMsg?.role === "user"}
      />
    </div>
  );
}
