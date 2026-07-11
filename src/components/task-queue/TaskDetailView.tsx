import { motion } from "framer-motion";
import { ArrowLeft, CheckCircle, XCircle, Clock, AlertTriangle } from "lucide-react";
import type { TaskQueueItem, TaskQueueStatus } from "@/types/taskQueue";

interface TaskDetailViewProps {
  task: TaskQueueItem;
  onBack: () => void;
}

const STATUS_CONFIG: Record<TaskQueueStatus, { icon: typeof CheckCircle; color: string; label: string }> = {
  queued: { icon: Clock, color: "text-blue-400", label: "Queued" },
  running: { icon: Clock, color: "text-oc-accent", label: "Running" },
  awaiting_permission: { icon: AlertTriangle, color: "text-orange-400", label: "Awaiting Permission" },
  completed: { icon: CheckCircle, color: "text-oc-accent", label: "Completed" },
  failed: { icon: XCircle, color: "text-red-400", label: "Failed" },
  abstained: { icon: AlertTriangle, color: "text-yellow-400", label: "Abstained" },
  cancelled: { icon: XCircle, color: "text-oc-text-secondary", label: "Cancelled" },
};

export function TaskDetailView({ task, onBack }: TaskDetailViewProps) {
  const cfg = STATUS_CONFIG[task.status];
  const Icon = cfg.icon;

  return (
    <div className="flex h-full flex-col p-4">
      <div className="mb-4 flex items-center gap-3">
        <motion.button
          whileTap={{ scale: 0.9 }}
          onClick={onBack}
          className="rounded-lg p-1 text-oc-text-secondary hover:text-oc-text-primary"
        >
          <ArrowLeft size={18} />
        </motion.button>
        <Icon size={18} className={cfg.color} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-oc-text-primary">
            {task.prompt}
          </p>
          <p className="text-xs text-oc-text-secondary">{cfg.label}</p>
        </div>
      </div>

      {/* Stats */}
      <div className="mb-4 grid grid-cols-3 gap-2">
        {[
          { label: "Category", value: task.category ?? "—" },
          { label: "Iterations", value: task.iterations },
          { label: "Tool Calls", value: task.toolCallsMade },
        ].map((stat) => (
          <div
            key={stat.label}
            className="rounded-xl bg-oc-surface/50 p-2 text-center"
          >
            <p className="text-[10px] text-oc-text-secondary">{stat.label}</p>
            <p className="text-sm font-medium text-oc-text-primary">
              {stat.value}
            </p>
          </div>
        ))}
      </div>

      {/* Steps */}
      <div className="flex-1 overflow-y-auto">
        <h3 className="mb-2 text-xs font-medium text-oc-text-secondary">
          ReAct Steps
        </h3>
        {task.steps.length === 0 ? (
          <p className="py-4 text-center text-xs text-oc-text-secondary">
            No step data available
          </p>
        ) : (
          <div className="space-y-2">
            {task.steps.map((step) => (
              <div
                key={step.iteration}
                className="rounded-xl border border-oc-surface-border bg-oc-surface/40 p-3"
              >
                <div className="mb-1 flex items-center gap-2">
                  <span className="rounded-full bg-oc-accent/20 px-2 py-0.5 text-[10px] text-oc-accent">
                    Step {step.iteration + 1}
                  </span>
                  <span className="text-[10px] text-oc-text-secondary">
                    {step.plan}
                  </span>
                </div>
                <p className="text-xs text-oc-text-primary">{step.thought}</p>
                {step.observations.length > 0 && (
                  <div className="mt-2 space-y-1">
                    {step.observations.map((obs, i) => (
                      <div
                        key={i}
                        className="flex items-center gap-2 text-[10px]"
                      >
                        {obs.success ? (
                          <CheckCircle size={10} className="text-oc-accent" />
                        ) : (
                          <XCircle size={10} className="text-red-400" />
                        )}
                        <span className="text-oc-text-secondary">
                          {obs.tool}
                        </span>
                        {obs.error && (
                          <span className="text-red-400">{obs.error}</span>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Result / Error */}
      {(task.result || task.error) && (
        <div className="mt-3 rounded-xl bg-oc-surface/50 p-3">
          {task.result && (
            <p className="text-xs text-oc-text-primary">{task.result}</p>
          )}
          {task.error && (
            <p className="text-xs text-red-400">{task.error}</p>
          )}
        </div>
      )}
    </div>
  );
}
