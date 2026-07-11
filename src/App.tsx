import * as React from "react";
import { Suspense } from "react";
import { Sidebar, type ViewKey } from "@/components/Sidebar";
import { Header } from "@/components/Header";
import { ChatView } from "@/components/ChatView";
import { FileSystemPanel } from "@/components/file-system/FileSystemPanel";
import { TerminalPanel } from "@/components/terminal/TerminalPanel";
import { GitPanel } from "@/components/git/GitPanel";
import { ToDoPanel } from "@/components/todo/ToDoPanel";
import { SkillsLibraryPanel } from "@/components/skills/SkillsLibraryPanel";
import { CronPanel } from "@/components/cron/CronPanel";
import { TaskQueuePanel } from "@/components/task-queue/TaskQueuePanel";
import { AuditLogPanel } from "@/components/audit-log/AuditLogPanel";
import { MemoryPanel } from "@/components/memory/MemoryPanel";
import { SubagentManagerPanel } from "@/components/settings/SubagentManagerPanel";
import { MCPManagerPanel } from "@/components/mcp/MCPManagerPanel";
import { SettingsPanel } from "@/components/SettingsPanel";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { SearchPanel } from "@/components/search/SearchPanel";
import { NotificationCenter } from "@/components/notifications/NotificationCenter";
import { PerformancePanel } from "@/components/settings/PerformancePanel";
import { RoutingPanel } from "@/components/settings/RoutingPanel";
import { MergeStrategyPanel } from "@/components/settings/MergeStrategyPanel";
import { ShortcutsPanel } from "@/components/settings/ShortcutsPanel";
import { BackgroundTaskPanel } from "@/components/background/BackgroundTaskPanel";
import { HarnessManagerPanel } from "@/components/settings/HarnessManagerPanel";
import { SystemPromptEditor } from "@/components/settings/SystemPromptEditor";
import { getValue, setValue } from "@/lib/storage";
import {
  loadProviders,
  saveProviders,
  loadActiveId,
  saveActiveId,
  loadTheme,
  saveTheme,
  type Provider,
} from "@/lib/providers";
import { DEFAULT_SYSTEM_PROMPT } from "@/types/conversation";

export default function App() {
  const [view, setView] = React.useState<ViewKey>("chat");
  const [providers, setProviders] = React.useState<Provider[]>([]);
  const [activeId, setActiveId] = React.useState<string | null>(null);
  const [theme, setTheme] = React.useState<"dark" | "light">("dark");
  const [settingsOpen, setSettingsOpen] = React.useState(false);
  const [ready, setReady] = React.useState(false);
  const [projectRoot, setProjectRoot] = React.useState("/OpenComputer");
  const [systemPrompt, setSystemPrompt] = React.useState(DEFAULT_SYSTEM_PROMPT);
  const [sessionId] = React.useState(() => crypto.randomUUID());

  React.useEffect(() => {
    (async () => {
      const [ps, id, th, root] = await Promise.all([
        loadProviders(),
        loadActiveId(),
        loadTheme(),
        getValue<string>("project_root"),
      ]);
      setProviders(ps);
      const validId = id && ps.some((p) => p.id === id) ? id : null;
      setActiveId(validId);
      setTheme(th);
      if (root) setProjectRoot(root);
      setReady(true);
    })();
  }, []);

  React.useEffect(() => {
    const root = document.documentElement;
    if (theme === "dark") root.classList.add("dark");
    else root.classList.remove("dark");
  }, [theme]);

  function persist(next: Provider[], id: string | null) {
    setProviders(next);
    setActiveId(id);
    saveProviders(next);
    saveActiveId(id);
  }

  function addProvider(p: Provider) {
    const next = [...providers, p];
    persist(next, activeId ?? p.id);
  }

  function updateProvider(p: Provider) {
    const next = providers.map((x) => (x.id === p.id ? p : x));
    persist(next, activeId);
  }

  function deleteProvider(id: string) {
    const next = providers.filter((x) => x.id !== id);
    const nextActive = activeId === id ? (next[0]?.id ?? null) : activeId;
    persist(next, nextActive);
  }

  function selectActive(id: string) {
    setActiveId(id);
    saveActiveId(id);
  }

  function toggleTheme() {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    saveTheme(next);
  }

  function changeProjectRoot(root: string) {
    const normalized = root.startsWith("/") ? root : `/${root}`;
    setProjectRoot(normalized);
    setValue("project_root", normalized);
  }

  function navigate(key: ViewKey) {
    if (key === "settings") {
      setSettingsOpen(true);
      return;
    }
    setView(key);
  }

  const activeProvider =
    providers.find((p) => p.id === activeId) ?? null;

  if (!ready) {
    return (
      <div className="flex h-full items-center justify-center bg-oc-bg text-oc-text-secondary">
        Loading…
      </div>
    );
  }

  const isDark = theme === "dark";

  return (
    <ErrorBoundary>
      <div className="flex h-full w-full overflow-hidden bg-oc-bg text-oc-text-primary">
        {/* Animated background */}
        <div className={`oc-background ${!isDark ? "light-theme" : ""}`}>
          <div className="oc-background-third" />
        </div>

        {/* Floating sidebar */}
        <Sidebar active={view} onNavigate={navigate} isDark={isDark} />

        {/* Main area */}
        <div className="flex min-w-0 flex-1 flex-col">
          <Header
            providers={providers}
            activeId={activeId}
            onSelectProvider={selectActive}
            theme={theme}
            onToggleTheme={toggleTheme}
          />
          <main className="min-h-0 flex-1 px-5 pb-5">
            <Suspense fallback={<div className="flex items-center justify-center h-screen text-[var(--oc-text-muted)]">Loading...</div>}>
              <div className={`oc-glass-panel flex h-full flex-col overflow-hidden ${!isDark ? "light-theme" : ""}`}>
                {view === "chat" && (
                  <ChatView
                    provider={activeProvider}
                    onOpenSettings={() => setSettingsOpen(true)}
                    systemPrompt={systemPrompt}
                  />
                )}
                {view === "files" && (
                  <FileSystemPanel
                    projectRoot={projectRoot}
                    onProjectRootChange={changeProjectRoot}
                  />
                )}
                {view === "terminal" && <TerminalPanel projectRoot={projectRoot} />}
                {view === "git" && <GitPanel projectRoot={projectRoot} />}
                {view === "todo" && <ToDoPanel />}
                {view === "skills" && <SkillsLibraryPanel />}
                {view === "cron" && <CronPanel />}
                {view === "queue" && <TaskQueuePanel />}
                {view === "audit" && <AuditLogPanel />}
                {view === "memory" && <MemoryPanel />}
                {view === "subagents" && <SubagentManagerPanel />}
                {view === "mcp" && <MCPManagerPanel />}
                {view === "search" && <SearchPanel />}
                {view === "notifications" && <NotificationCenter />}
                {view === "performance" && (
                  <PerformancePanel sessionId={sessionId} />
                )}
                {view === "routing" && <RoutingPanel />}
                {view === "merging" && <MergeStrategyPanel />}
                {view === "shortcuts" && <ShortcutsPanel />}
                {view === "background" && (
                  <BackgroundTaskPanel sessionId={sessionId} />
                )}
                {view === "harness" && <HarnessManagerPanel />}
                {view === "prompt" && (
                  <SystemPromptEditor
                    value={systemPrompt}
                    onSave={setSystemPrompt}
                  />
                )}
              </div>
            </Suspense>
          </main>
        </div>

        <SettingsPanel
          open={settingsOpen}
          onClose={() => setSettingsOpen(false)}
          providers={providers}
          activeId={activeId}
          onAdd={addProvider}
          onUpdate={updateProvider}
          onDelete={deleteProvider}
          onSelectActive={selectActive}
        />
      </div>
    </ErrorBoundary>
  );
}
