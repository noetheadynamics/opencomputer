import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Send,
  Bot,
  User,
  PlugZap,
  Wrench,
  Paperclip,
  Plus,
  MessageSquare,
  Trash2,
  StopCircle,
} from "lucide-react";
import {
  streamPhaosChat,
  type ChatMessage,
  type ToolCallInfo,
  type ToolResultInfo,
} from "@/lib/api";
import type { Provider } from "@/lib/providers";
import { cn } from "@/lib/utils";
import type { ChatAttachment, ChatReaction, CommandItem } from "@/types/chat";
import { DEFAULT_SYSTEM_PROMPT } from "@/types/conversation";
import { useConversations } from "../hooks/useConversations";
import { useMessages } from "../hooks/useMessages";
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
import { MessageContent } from "./MessageContent";

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
  saved?: boolean;
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
  const [showSidebar, setShowSidebar] = React.useState(false);
  const [expandedToolCalls, setExpandedToolCalls] = React.useState<Set<string>>(new Set());
  const abortRef = React.useRef<AbortController | null>(null);
  const queueRef = React.useRef<{ text: string; convId: string; attachments: ChatAttachment[]; replyTo: UIMessage | null }[]>([]);

  // Conversation persistence
  const {
    conversations,
    activeId: activeConvId,
    create: createConversation,
    remove: removeConversation,
    setActiveId: setActiveConvId,
  } = useConversations();
  const {
    load: loadMessages,
    addMessage: saveMessage,
  } = useMessages();

  // Sub-feature state
  const [replyTo, setReplyTo] = React.useState<UIMessage | null>(null);
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [longPressMsg, setLongPressMsg] = React.useState<UIMessage | null>(null);
  const [showCommandPalette, setShowCommandPalette] = React.useState(false);
  const [commandFilter, setCommandFilter] = React.useState("");
  const [attachments, setAttachments] = React.useState<ChatAttachment[]>([]);
  const [showScrollBtn, setShowScrollBtn] = React.useState(false);
  const [reactionPickerMsgId, setReactionPickerMsgId] = React.useState<string | null>(null);

  // Load messages when conversation changes — use returned value to avoid stale closure
  // Track which conversation we're loading to prevent race conditions
  const loadingConvIdRef = React.useRef<string | null>(null);

  React.useEffect(() => {
    if (activeConvId) {
      loadingConvIdRef.current = activeConvId;
      const snapshotLen = messages.length;
      loadMessages(activeConvId).then((msgs) => {
        // Only apply if we haven't switched to a different conversation
        if (loadingConvIdRef.current !== activeConvId) return;
        // If processMessage has added messages since load started, don't overwrite them
        setMessages((current) => {
          if (current.length > snapshotLen) return current;
          return msgs.map((m) => ({
            id: m.id,
            role: m.role as "user" | "assistant",
            content: m.content,
            timestamp: new Date(m.created_at).getTime(),
            saved: true,
          }));
        });
      });
    } else {
      loadingConvIdRef.current = null;
      setMessages([]);
    }
  }, [activeConvId, loadMessages]);

  React.useEffect(() => {
    scrollRef.current?.scrollTo?.({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages]);

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
    if (input.startsWith("/") && input.length < 20) {
      setShowCommandPalette(true);
      setCommandFilter(input);
    } else {
      setShowCommandPalette(false);
    }
  }, [input]);

  // Save a message to the backend — takes convId to avoid stale closure
  const persistMessage = React.useCallback(
    async (convId: string, role: "user" | "assistant", content: string) => {
      if (!convId || !content.trim()) return;
      try {
        await saveMessage(convId, role, content);
      } catch (err) {
        console.error("Failed to persist message:", err);
      }
    },
    [saveMessage],
  );

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
    if (cmd.handler === "compact") {
      setInput("");
      return;
    }
    if (cmd.handler === "export") {
      const text = messages.map((m) => `${m.role}: ${m.content}`).join("\n\n");
      navigator.clipboard.writeText(text);
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

  async function handleNewChat() {
    await createConversation("New Chat");
    setMessages([]);
    setInput("");
  }

  async function handleSelectConversation(convId: string) {
    setActiveConvId(convId);
    setShowSidebar(false);
  }

  async function handleDeleteConversation(convId: string) {
    await removeConversation(convId);
    if (activeConvId === convId) {
      setMessages([]);
    }
  }

  // Process a single message through the stream
  const processMessage = React.useCallback(async (
    text: string,
    convId: string,
    msgAttachments: ChatAttachment[],
    msgReplyTo: UIMessage | null,
  ) => {
    const userMsg: UIMessage = {
      id: uid(),
      role: "user",
      content: text,
      attachments: msgAttachments.length > 0 ? [...msgAttachments] : undefined,
      replyTo: msgReplyTo?.id,
      timestamp: Date.now(),
    };

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

    // Persist user message
    await persistMessage(convId, "user", text);

    const history: ChatMessage[] = [
      ...messages
        .filter((m) => m.role === "user" || m.role === "assistant")
        .map((m) => ({ role: m.role as "user" | "assistant", content: m.content })),
      { role: "user" as const, content: text },
    ];

    const controller = new AbortController();
    abortRef.current = controller;

    await streamPhaosChat(
      provider!,
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
        onApproval: (data) => {
          // Show approval request as a notification-style message
          setMessages((m) => [
            ...m,
            { id: uid(), role: "assistant" as const, content: `⚠️ Approval required: ${JSON.stringify(data.tool_name || data)}`, timestamp: Date.now() },
          ]);
        },
        onDone: async (fullResponse) => {
          setMessages((m) =>
            m.map((msg) =>
              msg.id === assistantId ? { ...msg, streaming: false } : msg,
            ),
          );
          if (fullResponse) {
            await persistMessage(convId, "assistant", fullResponse);
          }
          // Process queue
          const next = queueRef.current.shift();
          if (next) {
            processMessage(next.text, next.convId, next.attachments, next.replyTo);
          } else {
            setBusy(false);
          }
        },
        onError: (message) => {
          setMessages((m) =>
            m.map((msg) =>
              msg.id === assistantId
                ? { ...msg, streaming: false, content: `⚠️ ${message}` }
                : msg,
            ),
          );
          // Process queue even on error
          const next = queueRef.current.shift();
          if (next) {
            processMessage(next.text, next.convId, next.attachments, next.replyTo);
          } else {
            setBusy(false);
          }
        },
      },
      systemPrompt || DEFAULT_SYSTEM_PROMPT,
      controller.signal,
    );
    abortRef.current = null;
  }, [provider, messages, persistMessage, systemPrompt]);

  const send = React.useCallback(async () => {
    const text = input.trim();
    if ((!text && attachments.length === 0) || !provider) return;
    setInput("");
    setReplyTo(null);

    // Auto-create conversation if none active
    let convId = activeConvId;
    if (!convId) {
      try {
        const conv = await createConversation(text.slice(0, 50));
        convId = conv.id;
      } catch (err) {
        console.error("Failed to create conversation:", err);
        return;
      }
    }

    const currentAttachments = [...attachments];
    const currentReplyTo = replyTo;

    if (busy) {
      // Queue the message
      queueRef.current.push({ text, convId, attachments: currentAttachments, replyTo: currentReplyTo });
      setAttachments([]);
      return;
    }

    setAttachments([]);
    await processMessage(text, convId, currentAttachments, currentReplyTo);
  }, [input, provider, busy, activeConvId, attachments, replyTo, createConversation, processMessage]);

  function terminate() {
    if (abortRef.current) {
      abortRef.current.abort();
      abortRef.current = null;
    }
    queueRef.current = [];
    setBusy(false);
  }

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

      {/* Conversation sidebar toggle */}
      <div className="flex items-center border-b border-white/5 px-4 py-2">
        <button
          type="button"
          onClick={() => setShowSidebar(!showSidebar)}
          className="oc-glass-btn flex items-center gap-1.5 px-2.5 py-1 text-xs text-oc-text-secondary hover:text-oc-accent"
        >
          <MessageSquare size={14} />
          {conversations.length} conversation{conversations.length !== 1 ? "s" : ""}
        </button>
        <div className="flex-1" />
        <motion.button
          type="button"
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.9 }}
          onClick={handleNewChat}
          className="oc-glass-btn flex items-center gap-1 px-2.5 py-1 text-xs text-oc-text-secondary hover:text-oc-accent"
        >
          <Plus size={14} />
          New Chat
        </motion.button>
      </div>

      {/* Conversation sidebar */}
      <AnimatePresence>
        {showSidebar && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden border-b border-white/5"
          >
            <div className="max-h-48 overflow-y-auto px-2 py-2">
              {conversations.length === 0 && (
                <div className="px-3 py-2 text-xs text-oc-text-secondary">No conversations yet</div>
              )}
              {conversations.map((conv) => (
                <div
                  key={conv.id}
                  className={cn(
                    "group flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs cursor-pointer hover:bg-white/5",
                    activeConvId === conv.id && "bg-oc-accent/10 text-oc-accent",
                  )}
                  onClick={() => handleSelectConversation(conv.id)}
                >
                  <MessageSquare size={12} className="shrink-0" />
                  <span className="flex-1 truncate">{conv.title || "Untitled"}</span>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteConversation(conv.id);
                    }}
                    className="opacity-0 group-hover:opacity-100 text-oc-text-secondary hover:text-red-400"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

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
                    <div
                      className="flex items-center gap-1.5 text-oc-accent cursor-pointer select-none"
                      onClick={() => {
                        setExpandedToolCalls((prev) => {
                          const next = new Set(prev);
                          if (next.has(msg.id)) next.delete(msg.id);
                          else next.add(msg.id);
                          return next;
                        });
                      }}
                    >
                      <Wrench size={12} />
                      <span className="font-medium">{msg.toolCall.name}</span>
                      {!msg.toolResult && (
                        <span className="animate-pulse text-oc-text-secondary">…</span>
                      )}
                      <span className="ml-1 text-oc-text-secondary">
                        {expandedToolCalls.has(msg.id) ? "▾" : "▸"}
                      </span>
                    </div>
                    {expandedToolCalls.has(msg.id) && msg.toolCall.args && Object.keys(msg.toolCall.args).length > 0 && (
                      <pre className="mt-1 max-h-24 overflow-auto text-oc-text-secondary/70 whitespace-pre-wrap text-[10px]">
                        {JSON.stringify(msg.toolCall.args, null, 2)}
                      </pre>
                    )}
                    {msg.toolResult && (
                      <pre className="mt-1 max-h-48 overflow-auto text-oc-text-secondary whitespace-pre-wrap">
                        {expandedToolCalls.has(msg.id)
                          ? msg.toolResult.result.slice(0, 1000)
                          : msg.toolResult.result.slice(0, 150)}
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
                    {msg.replyTo && (
                      <div className="mb-1 text-xs text-oc-text-secondary italic truncate max-w-[200px]">
                        ↳ {messages.find((m) => m.id === msg.replyTo)?.content.slice(0, 50) ?? "…"}
                      </div>
                    )}

                    {msg.attachments && msg.attachments.length > 0 && (
                      <div className="mb-1 flex flex-wrap gap-1">
                        {msg.attachments.map((a) => (
                          <AttachmentPreview key={a.id} file={a} mini />
                        ))}
                      </div>
                    )}

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
                        {msg.role === "assistant" ? (
                          <MessageContent content={msg.content} />
                        ) : (
                          msg.content || (msg.streaming ? "" : "")
                        )}
                        {msg.streaming && !msg.content && <TypingIndicator />}
                        {msg.streaming && msg.content && (
                          <span className="ml-0.5 inline-block h-3 w-1.5 animate-pulse bg-oc-accent align-middle" />
                        )}
                        {msg.isEdited && (
                          <span className="ml-1 text-[10px] text-oc-text-secondary">(edited)</span>
                        )}
                      </div>
                    )}

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

                    {msg.role === "assistant" && !msg.streaming && extractUrls(msg.content).length > 0 && (
                      <div className="mt-2 space-y-2">
                        {extractUrls(msg.content).slice(0, 2).map((url) => (
                          <LinkPreview key={url} url={url} />
                        ))}
                      </div>
                    )}

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

      <ScrollToBottom
        show={showScrollBtn}
        onClick={() => {
          scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
          setShowScrollBtn(false);
        }}
      />

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

        <FormattingToolbar onFormat={handleFormat} />

        {queueRef.current.length > 0 && (
          <div className="mb-2 flex items-center gap-2 text-xs text-oc-text-secondary">
            <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-oc-accent" />
            {queueRef.current.length} message{queueRef.current.length > 1 ? "s" : ""} queued
          </div>
        )}

        <div className="flex items-end gap-2">
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
            {busy ? (
              <motion.button
                type="button"
                onClick={terminate}
                whileHover={{ scale: 1.05, y: -2, transition: glassSpring }}
                whileTap={{ scale: 0.9, y: 1, transition: tapSpring }}
                className="oc-glass-btn flex h-[42px] w-[42px] items-center justify-center rounded-xl bg-red-500/20 text-red-400 hover:bg-red-500/30"
                aria-label="Stop"
              >
                <StopCircle size={18} />
              </motion.button>
            ) : (
              <motion.button
                type="button"
                onClick={send}
                disabled={!input.trim() && attachments.length === 0}
                whileHover={{ scale: 1.05, y: -2, transition: glassSpring }}
                whileTap={{ scale: 0.9, y: 1, transition: tapSpring }}
                className="oc-glass-btn oc-glass-btn-primary flex h-[42px] w-[42px] items-center justify-center rounded-xl disabled:opacity-40"
                aria-label="Send"
              >
                <Send size={18} />
              </motion.button>
            )}
          </motion.div>
        </div>
      </div>

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
