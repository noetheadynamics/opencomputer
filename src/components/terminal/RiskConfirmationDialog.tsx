import { motion, AnimatePresence } from "framer-motion";
import { AlertTriangle } from "lucide-react";
import type { RiskAssessment } from "@/types/terminal";

interface RiskConfirmationDialogProps {
  risk: RiskAssessment | null;
  command: string | null;
  onConfirm: () => void;
  onCancel: () => void;
}

export function RiskConfirmationDialog({
  risk,
  command,
  onConfirm,
  onCancel,
}: RiskConfirmationDialogProps) {
  return (
    <AnimatePresence>
      {risk && command && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
          onClick={onCancel}
        >
          <motion.div
            initial={{ scale: 0.95, y: 10 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.95, y: 10 }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
            className="oc-glass-modal mx-4 w-full max-w-md p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-oc-danger/20">
                <AlertTriangle className="h-5 w-5 text-oc-danger" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-oc-text-primary">
                  Confirm High-Risk Command
                </h3>
                <p className="text-sm text-oc-text-secondary">{risk.reason}</p>
              </div>
            </div>

            <div className="mb-6 rounded-lg bg-oc-bg/60 px-4 py-3 font-mono text-sm text-oc-accent">
              {command}
            </div>

            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={onCancel}
                className="rounded-xl border border-oc-surface-border px-4 py-2 text-sm text-oc-text-secondary transition-colors hover:bg-oc-surface hover:text-oc-text-primary"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={onConfirm}
                className="rounded-xl bg-oc-danger px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-oc-danger/90 dark:oc-glow-sm"
              >
                Execute Anyway
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
