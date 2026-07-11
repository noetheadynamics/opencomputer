import { motion, AnimatePresence } from "framer-motion";
import { AlertTriangle } from "lucide-react";

interface GitConfirmationDialogProps {
  isOpen: boolean;
  title: string;
  message: string;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function GitConfirmationDialog({
  isOpen,
  title,
  message,
  danger = false,
  onConfirm,
  onCancel,
}: GitConfirmationDialogProps) {
  return (
    <AnimatePresence>
      {isOpen && (
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
            className={`oc-glass-modal mx-4 w-full max-w-md p-6 ${
              danger
                ? "border-oc-danger/30"
                : "border-oc-accent/30"
            }`}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-center gap-3">
              <div
                className={`flex h-10 w-10 items-center justify-center rounded-full ${
                  danger ? "bg-oc-danger/20" : "bg-oc-accent/20"
                }`}
              >
                <AlertTriangle
                  className={`h-5 w-5 ${
                    danger ? "text-oc-danger" : "text-oc-accent"
                  }`}
                />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-oc-text-primary">
                  {title}
                </h3>
              </div>
            </div>

            <p className="mb-6 text-sm text-oc-text-secondary">{message}</p>

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
                className={`rounded-xl px-4 py-2 text-sm font-medium text-white transition-colors ${
                  danger
                    ? "bg-oc-danger hover:bg-oc-danger/90"
                    : "bg-oc-accent hover:bg-oc-accent/90"
                } dark:oc-glow-sm`}
              >
                Confirm
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
