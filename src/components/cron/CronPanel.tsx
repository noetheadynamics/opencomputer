import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, Trash2, Clock, CheckCircle, XCircle, Power, PowerOff } from "lucide-react";
import { useCron } from "@/hooks/useCron";
import { CronForm } from "./CronForm";
import { cn } from "@/lib/utils";

const tapSpring = { type: "spring" as const, stiffness: 700, damping: 20 };

export function CronPanel() {
  const { jobs, loading, create, toggle, remove } = useCron();
  const [showForm, setShowForm] = useState(false);

  return (
    <div className="flex h-full flex-col p-4">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-oc-text-primary">
          Scheduled Tasks
        </h2>
        <motion.button
          whileTap={{ scale: 0.95, transition: tapSpring }}
          onClick={() => setShowForm(!showForm)}
          className="oc-glass-btn-primary flex items-center gap-1 px-3 py-1.5 text-sm"
        >
          <Plus size={14} />
          New
        </motion.button>
      </div>

      <AnimatePresence>
        {showForm && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="mb-4 overflow-hidden rounded-2xl border border-oc-surface-border bg-oc-surface/60"
          >
            <CronForm
              onSubmit={(req) => {
                create(req);
                setShowForm(false);
              }}
              onCancel={() => setShowForm(false)}
            />
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex-1 space-y-2 overflow-y-auto">
        {loading && (
          <p className="py-8 text-center text-sm text-oc-text-secondary">
            Loading...
          </p>
        )}
        {!loading && jobs.length === 0 && (
          <p className="py-8 text-center text-sm text-oc-text-secondary">
            No scheduled tasks. Create one above.
          </p>
        )}
        {jobs.map((job) => (
          <motion.div
            key={job.id}
            layout
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className={cn(
              "flex items-center gap-3 rounded-2xl border border-oc-surface-border p-3",
              "bg-oc-surface/50 backdrop-blur-md",
              !job.enabled && "opacity-60",
            )}
          >
            <Clock size={16} className="shrink-0 text-oc-text-secondary" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm text-oc-text-primary">
                {job.description}
              </p>
              <p className="font-mono text-xs text-oc-text-secondary">
                {job.schedule}
              </p>
            </div>
            <div className="flex items-center gap-2">
              {job.lastStatus === "success" && (
                <CheckCircle size={14} className="text-oc-accent" />
              )}
              {job.lastStatus === "failure" && (
                <XCircle size={14} className="text-red-400" />
              )}
              <motion.button
                whileTap={{ scale: 0.8, transition: tapSpring }}
                onClick={() => toggle(job.id, !job.enabled)}
                className="p-1 text-oc-text-secondary hover:text-oc-accent"
              >
                {job.enabled ? <Power size={14} /> : <PowerOff size={14} />}
              </motion.button>
              <motion.button
                whileTap={{ scale: 0.8, transition: tapSpring }}
                onClick={() => remove(job.id)}
                className="p-1 text-oc-text-secondary hover:text-red-400"
              >
                <Trash2 size={14} />
              </motion.button>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
