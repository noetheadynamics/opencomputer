import { useState } from "react";
import { cn } from "@/lib/utils";
import { TaskQueuePanel } from "./TaskQueuePanel";
import { BackgroundTaskPanel } from "@/components/background/BackgroundTaskPanel";

interface TasksPanelProps {
  sessionId: string;
}

type Tab = "scheduled" | "running";

const TABS: { key: Tab; label: string }[] = [
  { key: "scheduled", label: "Scheduled" },
  { key: "running", label: "Running" },
];

export function TasksPanel({ sessionId }: TasksPanelProps) {
  const [tab, setTab] = useState<Tab>("scheduled");

  return (
    <div className="flex h-full flex-col">
      <div className="flex gap-1 border-b border-oc-surface-border px-4 pt-3">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={cn(
              "rounded-t-lg px-3 py-1.5 text-xs font-medium transition-colors",
              tab === t.key
                ? "bg-oc-surface/80 text-oc-accent"
                : "text-oc-text-secondary hover:text-oc-text-primary",
            )}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div className="min-h-0 flex-1 overflow-hidden">
        {tab === "scheduled" && <TaskQueuePanel />}
        {tab === "running" && <BackgroundTaskPanel sessionId={sessionId} />}
      </div>
    </div>
  );
}
