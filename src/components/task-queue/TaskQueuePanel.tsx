import { motion } from "framer-motion";
import {
  RefreshCw,
  XCircle,
} from "lucide-react";
import { useTaskQueue } from "@/hooks/useTaskQueue";
import { TaskDetailView } from "./TaskDetailView";
import type { TaskQueueStatus } from "@/types/taskQueue";
import { cn } from "@/lib/utils";

const STATUS_BADGE: Record<TaskQueueStatus, { color: string; label: string }> = {
  queued: { color: "bg-blue-500/20 text-blue-400", label: "Queued" },
  running: { color: "bg-oc-accent/20 text-oc-accent", label: "Running" },
  awaiting_permission: { color: "bg-orange-500/20 text-orange-400", label: "Permission" },
  completed: { color: "bg-oc-accent/20 text-oc-accent", label: "Done" },
  failed: { color: "bg-red-500/20 text-red-400", label: "Failed" },
  abstained: { color: "bg-yellow-500/20 text-yellow-400", label: "Abstained" },
  cancelled: { color: "bg-oc-text-secondary/20 text-oc-text-secondary", label: "Cancelled" },
};

const tapSpring = { type: "spring" as const, stiffness: 700, damping: 20 };

export function TaskQueuePanel() {
  const { tasks, loading, selectedId, selectedDetail, refresh, selectTask, deselectTask, cancelTask } =
    useTaskQueue();

  if (selectedId && selectedDetail) {
    return <TaskDetailView task={selectedDetail} onBack={deselectTask} />;
  }

  const active = tasks.filter((t) =>
    ["queued", "running", "awaiting_permission"].includes(t.status),
  );
  const recent = tasks.filter((t) =>
    ["completed", "failed", "abstained", "cancelled"].includes(t.status),
  );

  return (
    <div className="flex h-full flex-col p-4">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-oc-text-primary">
          Task Queue
        </h2>
        <motion.button
          whileTap={{ scale: 0.9, rotate: 180 }}
          onClick={refresh}
          className="rounded-lg p-1.5 text-oc-text-secondary hover:text-oc-accent"
        >
          <RefreshCw size={16} />
        </motion.button>
      </div>

      <div className="flex-1 overflow-y-auto">
        {loading && tasks.length === 0 && (
          <p className="py-8 text-center text-sm text-oc-text-secondary">
            Loading...
          </p>
        )}

        {/* Active tasks */}
        {active.length > 0 && (
          <>
            <h3 className="mb-2 text-xs font-medium text-oc-text-secondary">
              Active ({active.length})
            </h3>
            <div className="mb-4 space-y-2">
              {active.map((task) => {
                const badge = STATUS_BADGE[task.status];
                return (
                  <motion.div
                    key={task.id}
                    layout
                    onClick={() => selectTask(task.id)}
                    className={cn(
                      "cursor-pointer rounded-2xl border border-oc-surface-border p-3",
                      "bg-oc-surface/50 backdrop-blur-md transition-colors hover:bg-oc-surface/80",
                    )}
                  >
                    <div className="flex items-center gap-2">
                      <span
                        className={cn(
                          "rounded-full px-2 py-0.5 text-[10px] font-medium",
                          badge.color,
                        )}
                      >
                        {badge.label}
                      </span>
                      <span className="min-w-0 flex-1 truncate text-sm text-oc-text-primary">
                        {task.prompt}
                      </span>
                      {["queued", "running"].includes(task.status) && (
                        <motion.button
                          whileTap={{ scale: 0.8, transition: tapSpring }}
                          onClick={(e) => {
                            e.stopPropagation();
                            cancelTask(task.id);
                          }}
                          className="p-1 text-oc-text-secondary hover:text-red-400"
                        >
                          <XCircle size={14} />
                        </motion.button>
                      )}
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </>
        )}

        {/* Recent */}
        {recent.length > 0 && (
          <>
            <h3 className="mb-2 text-xs font-medium text-oc-text-secondary">
              Recent
            </h3>
            <div className="space-y-2">
              {recent.slice(0, 10).map((task) => {
                const badge = STATUS_BADGE[task.status];
                return (
                  <motion.div
                    key={task.id}
                    layout
                    onClick={() => selectTask(task.id)}
                    className={cn(
                      "cursor-pointer rounded-2xl border border-oc-surface-border p-3",
                      "bg-oc-surface/30 backdrop-blur-md transition-colors hover:bg-oc-surface/50",
                    )}
                  >
                    <div className="flex items-center gap-2">
                      <span
                        className={cn(
                          "rounded-full px-2 py-0.5 text-[10px] font-medium",
                          badge.color,
                        )}
                      >
                        {badge.label}
                      </span>
                      <span className="min-w-0 flex-1 truncate text-sm text-oc-text-primary">
                        {task.prompt}
                      </span>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </>
        )}

        {!loading && tasks.length === 0 && (
          <p className="py-8 text-center text-sm text-oc-text-secondary">
            No tasks yet
          </p>
        )}
      </div>
    </div>
  );
}
