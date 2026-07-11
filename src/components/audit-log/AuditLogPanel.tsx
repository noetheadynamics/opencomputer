import { useState } from "react";
import { motion } from "framer-motion";
import { Download, Filter, RefreshCw } from "lucide-react";
import { useAuditLog } from "@/hooks/useAuditLog";
import type { AuditAction, AuditOutcome } from "@/types/auditLog";
import { cn } from "@/lib/utils";

const ACTION_OPTIONS: AuditAction[] = [
  "file_read", "file_write", "file_delete", "file_create",
  "terminal_command", "git_push", "git_pull", "git_commit",
  "skill_execute", "task_create", "task_complete",
  "permission_grant", "permission_deny",
];

const OUTCOME_OPTIONS: AuditOutcome[] = ["executed", "approved", "rejected", "failed"];

const OUTCOME_COLORS: Record<AuditOutcome, string> = {
  executed: "text-oc-accent",
  approved: "text-oc-accent",
  rejected: "text-red-400",
  failed: "text-red-400",
};

export function AuditLogPanel() {
  const { entries, loading, updateFilters, refresh, exportCsv } =
    useAuditLog();
  const [actionFilter, setActionFilter] = useState<string>("");
  const [outcomeFilter, setOutcomeFilter] = useState<string>("");

  function handleFilterChange(action: string, outcome: string) {
    setActionFilter(action);
    setOutcomeFilter(outcome);
    updateFilters({
      action: (action as AuditAction) || undefined,
      outcome: (outcome as AuditOutcome) || undefined,
    });
  }

  function handleExport() {
    const csv = exportCsv();
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `audit-log-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="flex h-full flex-col p-4">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-oc-text-primary">
          Security Audit Log
        </h2>
        <div className="flex gap-2">
          <motion.button
            whileTap={{ scale: 0.9 }}
            onClick={refresh}
            className="rounded-lg p-1.5 text-oc-text-secondary hover:text-oc-accent"
          >
            <RefreshCw size={16} />
          </motion.button>
          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={handleExport}
            className="oc-glass-btn flex items-center gap-1 px-3 py-1.5 text-sm"
          >
            <Download size={14} />
            Export CSV
          </motion.button>
        </div>
      </div>

      {/* Filters */}
      <div className="mb-3 flex gap-2">
        <div className="oc-glass-input flex items-center gap-2 px-3 py-1.5">
          <Filter size={12} className="text-oc-text-secondary" />
          <select
            value={actionFilter}
            onChange={(e) => handleFilterChange(e.target.value, outcomeFilter)}
            className="bg-transparent text-xs text-oc-text-primary outline-none"
          >
            <option value="">All actions</option>
            {ACTION_OPTIONS.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </select>
        </div>
        <div className="oc-glass-input flex items-center gap-2 px-3 py-1.5">
          <select
            value={outcomeFilter}
            onChange={(e) => handleFilterChange(actionFilter, e.target.value)}
            className="bg-transparent text-xs text-oc-text-primary outline-none"
          >
            <option value="">All outcomes</option>
            {OUTCOME_OPTIONS.map((o) => (
              <option key={o} value={o}>
                {o}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-y-auto">
        {loading && (
          <p className="py-8 text-center text-sm text-oc-text-secondary">
            Loading...
          </p>
        )}
        {!loading && entries.length === 0 && (
          <p className="py-8 text-center text-sm text-oc-text-secondary">
            No audit entries
          </p>
        )}
        <div className="space-y-1">
          {entries.map((entry) => (
            <div
              key={entry.id}
              className="flex items-center gap-3 rounded-xl bg-oc-surface/30 px-3 py-2 text-xs"
            >
              <span className="w-36 shrink-0 font-mono text-oc-text-secondary">
                {new Date(entry.timestamp).toLocaleString()}
              </span>
              <span className="w-28 shrink-0 rounded-full bg-oc-bg/50 px-2 py-0.5 text-center text-oc-text-secondary">
                {entry.action}
              </span>
              <span className="min-w-0 flex-1 truncate text-oc-text-primary">
                {entry.description}
              </span>
              <span
                className={cn(
                  "w-16 shrink-0 text-center",
                  OUTCOME_COLORS[entry.outcome],
                )}
              >
                {entry.outcome}
              </span>
              <span className="w-20 shrink-0 text-center text-oc-text-secondary">
                {entry.taskId ?? "—"}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
