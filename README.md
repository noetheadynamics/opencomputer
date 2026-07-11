# OpenComputer

A native desktop AI agent with floating frosted glass 3D UI — built on **Tauri v2 + React + TypeScript + Tailwind**, supporting any **OpenAI-compatible** provider.

> **401 tests passing** · 15 development phases complete · Provider-agnostic · No Docker · Local-first

## What It Does

OpenComputer is a full-featured desktop AI agent that runs locally on your machine. It connects to any OpenAI-compatible LLM provider, stores conversations and memory in local SQLite, and gives you real tools — file operations, terminal, git, web search — all from a premium glassmorphism interface.

## Features

### Core AI Chat
- **Provider-agnostic** — configure any OpenAI-compatible endpoint (base URL + API key + model). Multiple saved profiles.
- **Streaming responses** — real-time SSE streaming with typing indicators.
- **Chat history** — persistent conversations stored in local SQLite.
- **System prompt editor** — customize the AI's behavior per conversation.
- **Message feedback** — thumbs up/down on responses with correction workflow.

### PHAOS Backend (Python)
- **ReAct agent loop** — structured reasoning with tool calls and state machine.
- **Background tasks** — async task execution with SQLite-backed tracking.
- **Model merging** — Sens-Merging, Activation-Informed Merging, Dynamic Merging with an optimizer that auto-selects strategies.
- **Compact context** — model-driven context compaction with `compact`, `discard`, `protect`, and `prune` tools.
- **Memory store** — SQLite FTS5 full-text search for facts and knowledge.
- **Self-teaching** — automated learning from user corrections.
- **Auto-retry** — intelligent retry with error context.
- **Cron scheduler** — APScheduler for recurring tasks.

### Web Search & Scraping
- **Multi-engine search** — DuckDuckGo (no API key), Google, Bing, SearXNG.
- **HTML→Markdown scraping** — converts web pages to clean markdown.
- **Crawl** — recursive crawling with depth control and same-domain restriction.
- **Search history** — SQLite-backed with favorites and export.
- **Rate limiting** — configurable per-engine request throttling.

### Subagent Manager
- **CRUD operations** — create, read, update, delete custom subagents.
- **Enable/disable toggle** — activate subagents on demand.
- **Tool permissions** — control which tools each subagent can access.
- **System prompt editor** — per-subagent custom instructions.
- **Test runner** — test subagents with live model callbacks.
- **Task type mapping** — assign subagents to specific task categories (code, research, analysis, etc.).

### Chat Enhancements (Phase 14)
- **File/image attachments** — drag-and-drop upload with progress indicators.
- **Command palette** — `/code`, `/vision`, `/search`, `/file`, `/clear`, `/compact`, `/export`, `/help` commands.
- **@mentions** — mention subagents and tools with popover suggestions.
- **Formatting toolbar** — bold, italic, code, lists, links, quotes.
- **Artifacts panel** — side panel for generated code, images, and documents.

### MCP & Plugin Manager (Phase 15)
- **Browse catalog** — 15+ popular MCP servers (Slack, Gmail, Notion, GitHub, WhatsApp, Telegram, Discord, etc.).
- **One-click install** — install MCP servers via npm/pip directly from the UI.
- **Configure** — set environment variables (API keys, tokens) via form fields.
- **Enable/disable** — toggle MCP servers on/off without uninstalling.
- **Remove** — uninstall MCP servers from the UI.
- **View status** — see if each server is running, connected, or errored.
- **Tool list** — see what tools each MCP server provides.
- **Custom MCP server** — add any MCP server manually (command, args, env vars).
- **Logs view** — see logs for each MCP server.
- **Plugin discovery** — auto-detect installed plugins with enable/disable toggle.

### Premium UI/UX (Phase 14)
- **iMessage-style chat bubbles** — rounded corners, user/assistant tails, blue link text.
- **Link previews** — auto-generated URL preview cards.
- **Reactions** — 9-emoji reaction picker (Telegram style) with spring animations.
- **Long press menu** — Copy, Reply, Edit, Delete on mobile/touch.
- **Threaded replies** — slide-in thread panel for message threads.
- **Time-based grouping** — date headers between message groups.
- **Typing indicator** — iOS-style animated three dots.
- **Avatars** — user/bot avatars with size variants.
- **Scroll to bottom** — floating button when scrolled up.
- **Swipe to reply** — touch gesture for mobile reply.

### Design System
- **Floating frosted glass 3D** — Apple Liquid Glass style with `.oc-glass-3d` domed convex panels, dual inset shadows, gradient rim-light borders.
- **Animated gradient blobs** — 3 drifting color blobs as background.
- **Framer Motion gestures** — whileHover (scale 1.05-1.08, y -3), whileTap (scale 0.9-0.92, y 1) with spring physics.
- **Dark mode default** — glow box-shadows only in dark mode; light mode fully supported.
- **Token-driven** — `--oc-bg: #050605`, `--oc-surface: #0F1211`, `--oc-accent: #34D399`.
- **iOS-inspired polish** — glassmorphic modals, floating nav pills, concave inputs.

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    OpenComputer (Tauri v2)                      │
├─────────────────────────────────────────────────────────────────┤
│  React UI  ←→  Tauri Rust Shell  ←→  SQLite + Filesystem       │
└─────────────────────────────────────────────────────────────────┘
         ↕                          ↕
┌────────────────────┐  ┌────────────────────────────────────┐
│  PHAOS Backend     │  │  MCP Tools                          │
│  (Python FastAPI)  │  │  File · Terminal · Git · Web · DB   │
│  Port 8420         │  │  Webhooks · Cron · Search           │
└────────────────────┘  └────────────────────────────────────┘
         ↕
┌─────────────────────────────────────────────────────────────────┐
│  Any OpenAI-Compatible LLM Provider                             │
│  (Cerebras, Groq, OpenAI, Anthropic, Ollama, etc.)             │
└─────────────────────────────────────────────────────────────────┘
```

### Frontend Stack
- **Tauri v2** — native desktop shell with Rust backend
- **React 18** — UI framework with hooks
- **TypeScript** — strict mode, zero errors
- **Tailwind CSS** — utility-first with custom glassmorphism classes
- **Framer Motion** — spring animations and gestures
- **CodeMirror** — code editor with syntax highlighting
- **Lucide React** — icon library

### Backend Stack
- **Python 3.12+** — PHAOS agent backend
- **FastAPI** — async API server on port 8420
- **SQLite** — conversations, memory, tasks, subagents, search history, MCP servers
- **LiteLLM** — model-agnostic LLM calls
- **APScheduler** — background task scheduling
- **tiktoken** — token counting for context management

## Prerequisites

- [Node.js](https://nodejs.org) (v18+)
- [Rust](https://www.rust-lang.org/tools/install) + MSVC build tools (Windows) — required for `tauri dev` / `tauri build`
- [WebView2](https://developer.microsoft.com/microsoft-edge/webview2/) (ships with Windows 11)
- [Python 3.12+](https://www.python.org/) — for PHAOS backend

## Run Locally

### Frontend (Browser Mode)
```bash
npm install
npm run dev          # Vite dev server on http://localhost:1420
```

### Full Desktop App
```bash
npm run tauri dev    # launches native window (frontend + Rust shell)
```

### PHAOS Backend
```bash
cd phaos
pip install -r requirements.txt
python main.py       # FastAPI on http://localhost:8420
```

## Build

```bash
npm run tauri build  # outputs installer to src-tauri/target/release/bundle/
```

## Configuration

### LLM Providers
Configure in the app's Settings panel. Credentials stored locally via Tauri's store plugin — never committed to the repo.

### PHAOS Environment
```env
# LLM (any OpenAI-compatible API)
LLM_API_KEY=your_key_here
LLM_BASE_URL=https://api.provider.com/v1
LLM_MODEL=your-model-name

# Web retrieval
JINA_API_KEY=your_jina_key
TAVILY_API_KEY=your_tavily_key
```

## Tests

```bash
# Frontend (57 tests)
npm test

# PHAOS Backend (344 tests)
cd phaos
python -m pytest tests/ -v

# All tests (401 total)
npm test && cd phaos && python -m pytest tests/ -v
```

## Brand Assets

Drop the OpenComputer logos into `public/` (see `public/PLACEHOLDER.txt`):

- `opencomputer-icon.png` — mark only → Tauri app icon + UI mark
- `opencomputer-logo.png` — mark + wordmark → header logo
- `opencomputer-transparent.png` — gradient bg + wordmark → splash

Then regenerate the Tauri icons:

```bash
npx tauri icon public/opencomputer-icon.png
```

## Project Layout

```
OpenComputer/
├── src/                          # React frontend
│   ├── components/
│   │   ├── chat/                 # ChatBubble, ChatInput, CommandPalette, MentionsPopover, etc.
│   │   ├── mcp/                  # MCPManagerPanel, MCPCard, MCPInstallModal, MCPConfigModal, etc.
│   │   ├── memory/               # TruthVault, CrossSessionState, MemoryStore viewers
│   │   ├── search/               # SearchPanel with tabs, filters, export
│   │   ├── settings/             # SystemPromptEditor, MergeStrategyPanel, SubagentManagerPanel
│   │   ├── background/           # BackgroundTaskPanel
│   │   ├── Sidebar.tsx           # Floating nav pills
│   │   ├── Header.tsx            # Provider selector + theme toggle
│   │   ├── ChatView.tsx          # Messages with streaming
│   │   ├── SettingsPanel.tsx     # Provider list, edit/delete
│   │   ├── ProviderForm.tsx      # Add/Edit provider form
│   │   └── Logo.tsx              # Image with fallback
│   ├── hooks/                    # useMCP, useMCPInstall, useAttachments, useThreads, etc.
│   ├── lib/                      # api, mcp, storage, providers, upload, links, reactions
│   ├── types/                    # chat, mcp, subagent, memory, merging, search, etc.
│   ├── index.css                 # Design tokens + glassmorphism system
│   └── App.tsx                   # Central state + panel routing
├── phaos/                        # Python PHAOS backend
│   ├── engine/                   # ReAct loop, state machine, tool router, error recovery
│   ├── core/                     # Memory store, self-teaching, streaming, scheduler, MCP registry/manager/installer
│   ├── db/                       # SQLite database, migrations
│   ├── routes/                   # API endpoints (conversations, memory, search, merging, mcp, etc.)
│   └── tests/                    # 344 backend tests
├── src-tauri/                    # Rust native shell (Tauri v2 + store plugin)
├── public/                       # Brand assets (icons, logos)
└── index.html                    # App entry point
```

## Key Files

| File | Purpose |
|------|---------|
| `src/App.tsx` | Central state management, panel routing, all feature wiring |
| `src/index.css` | Complete glassmorphism design system with tokens |
| `src/components/Sidebar.tsx` | Floating nav pills for panel navigation |
| `src/components/chat/ChatInput.tsx` | Full input with toolbar, attachments, commands, mentions |
| `src/components/chat/ChatBubble.tsx` | iMessage-style bubble with reactions, long press, links |
| `src/components/mcp/MCPManagerPanel.tsx` | MCP server management UI with catalog, install, config |
| `src/components/settings/SubagentManagerPanel.tsx` | Subagent CRUD, toggle, test, tool permissions |
| `phaos/engine/react_loop.py` | ReAct agent loop with auto-compact reminders |
| `phaos/engine/tool_router.py` | Tool registry, sandbox executor, compact tools |
| `phaos/core/mcp_registry.py` | SQLite MCP server registry |
| `phaos/core/mcp_manager.py` | MCP server subprocess management |
| `phaos/core/mcp_installer.py` | MCP server npm/pip install/uninstall |
| `phaos/routes/mcp.py` | MCP management API (17 endpoints) |
| `phaos/core/memory_store.py` | SQLite FTS5 memory store |
| `phaos/core/web_search.py` | Multi-engine web search |
| `phaos/core/compact_context.py` | DCP compaction with model-driven tools |
| `phaos/core/subagent_manager.py` | SQLite subagent CRUD and testing |

## Design System Quick Reference

| Class | Usage |
|-------|-------|
| `.oc-glass-3d` | Domed convex glass panel with rim-light border |
| `.oc-glass-panel` | 24px content panels |
| `.oc-glass-modal` | Highest elevation dialogs |
| `.oc-floating-icon` | 50% nav pills with 16px gaps |
| `.oc-pill` | 999px header pills |
| `.oc-glass-btn` / `.oc-glass-btn-primary` | Buttons with hover glow |
| `.oc-glass-input` | 12px concave inputs |

## License

MIT
