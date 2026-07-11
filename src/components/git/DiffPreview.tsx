import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";
import type { DiffResult } from "@/types/git";

interface DiffPreviewProps {
  diffResult: DiffResult | null;
  onClose: () => void;
}

function parseDiffLines(diff: string): Array<{ type: "add" | "del" | "ctx"; text: string }> {
  return diff.split("\n").map((line) => {
    if (line.startsWith("+")) return { type: "add", text: line.slice(1) };
    if (line.startsWith("-")) return { type: "del", text: line.slice(1) };
    return { type: "ctx", text: line };
  });
}

export function DiffPreview({ diffResult, onClose }: DiffPreviewProps) {
  const lines = diffResult ? parseDiffLines(diffResult.diff) : [];

  return (
    <AnimatePresence>
      {diffResult && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.95, y: 10 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.95, y: 10 }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
            className="oc-glass-modal mx-4 flex max-h-[80vh] w-full max-w-3xl flex-col overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-oc-surface-border px-4 py-3">
              <div>
                <h3 className="text-sm font-semibold text-oc-text-primary">
                  Diff Preview
                </h3>
                <p className="text-xs text-oc-text-secondary">
                  {diffResult.filePath}
                </p>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg p-1.5 text-oc-text-secondary transition-colors hover:bg-oc-surface hover:text-oc-text-primary"
              >
                <X size={16} />
              </button>
            </div>

            {/* Diff content */}
            <div className="min-h-0 flex-1 overflow-auto p-4 font-mono text-xs">
              {lines.map((line, i) => (
                <div
                  key={i}
                  className={`whitespace-pre px-2 py-0.5 ${
                    line.type === "add"
                      ? "bg-oc-accent/10 text-oc-accent"
                      : line.type === "del"
                        ? "bg-red-500/10 text-red-400"
                        : "text-oc-text-secondary"
                  }`}
                >
                  {line.type === "add" ? "+" : line.type === "del" ? "-" : " "}
                  {line.text}
                </div>
              ))}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
