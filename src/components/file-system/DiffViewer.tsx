import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { diffLines, type Change } from "diff";
import { Check, X, Columns2, AlignLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface DiffViewerProps {
  isOpen: boolean;
  filePath: string;
  originalContent: string;
  proposedContent: string;
  onAccept: () => void;
  onReject: () => void;
  onClose: () => void;
}

interface Line {
  text: string;
  changed: boolean;
}

function toSides(original: string, proposed: string) {
  const parts: Change[] = diffLines(original, proposed);
  const left: Line[] = [];
  const right: Line[] = [];
  for (const part of parts) {
    const lines = part.value.replace(/\n$/, "").split("\n");
    if (part.removed) {
      for (const l of lines) left.push({ text: l, changed: true });
    } else if (part.added) {
      for (const l of lines) right.push({ text: l, changed: true });
    } else {
      for (const l of lines) {
        left.push({ text: l, changed: false });
        right.push({ text: l, changed: false });
      }
    }
  }
  return { left, right };
}

export function DiffViewer({
  isOpen,
  filePath,
  originalContent,
  proposedContent,
  onAccept,
  onReject,
  onClose,
}: DiffViewerProps) {
  const [mode, setMode] = React.useState<"side" | "inline">("side");
  const parts = React.useMemo(() => diffLines(originalContent, proposedContent), [
    originalContent,
    proposedContent,
  ]);
  const sides = React.useMemo(
    () => toSides(originalContent, proposedContent),
    [originalContent, proposedContent],
  );

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.16 }}
        >
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
          <motion.div
            initial={{ opacity: 0, scale: 0.97, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97, y: 16 }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
            className="oc-glass flex max-h-[88vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl shadow-2xl"
          >
            <div className="flex items-center justify-between border-b border-oc-surface-border px-5 py-4">
              <div className="min-w-0">
                <h2 className="text-base font-semibold text-oc-text-primary">
                  Proposed change
                </h2>
                <p className="truncate text-xs text-oc-text-secondary">{filePath}</p>
              </div>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setMode("side")}
                  title="Side by side"
                  className={cn(
                    "rounded-lg p-1.5 transition-colors hover:bg-oc-surface",
                    mode === "side" ? "text-oc-accent" : "text-oc-text-secondary",
                  )}
                >
                  <Columns2 size={16} />
                </button>
                <button
                  type="button"
                  onClick={() => setMode("inline")}
                  title="Inline"
                  className={cn(
                    "rounded-lg p-1.5 transition-colors hover:bg-oc-surface",
                    mode === "inline" ? "text-oc-accent" : "text-oc-text-secondary",
                  )}
                >
                  <AlignLeft size={16} />
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  className="rounded-lg p-1.5 text-oc-text-secondary transition-colors hover:bg-oc-surface hover:text-oc-text-primary"
                  aria-label="Close"
                >
                  <X size={16} />
                </button>
              </div>
            </div>

            <div className="min-h-0 flex-1 overflow-auto bg-oc-bg/40 p-1 font-mono text-xs leading-relaxed">
              {mode === "side" ? (
                <div className="grid grid-cols-2 gap-px">
                  <DiffColumn title="Original" lines={sides.left} />
                  <DiffColumn title="Proposed" lines={sides.right} />
                </div>
              ) : (
                <div>
                  {parts.map((part, i) => (
                    <div
                      key={i}
                      className={cn(
                        "whitespace-pre-wrap px-3",
                        part.added && "bg-oc-accent/15 text-oc-text-primary",
                        part.removed && "bg-red-500/15 text-red-200",
                      )}
                    >
                      {part.value.replace(/\n$/, "")}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 border-t border-oc-surface-border px-5 py-4">
              <Button variant="ghost" onClick={onReject}>
                <X size={15} /> Reject
              </Button>
              <Button onClick={onAccept}>
                <Check size={15} /> Accept
              </Button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function DiffColumn({ title, lines }: { title: string; lines: Line[] }) {
  return (
    <div className="overflow-hidden">
      <div className="sticky top-0 bg-oc-surface/80 px-3 py-1 text-[10px] uppercase tracking-wide text-oc-text-secondary backdrop-blur">
        {title}
      </div>
      {lines.map((l, i) => (
        <div
          key={i}
          className={cn(
            "whitespace-pre-wrap px-3",
            l.changed &&
              (title === "Original"
                ? "bg-red-500/15 text-red-200"
                : "bg-oc-accent/15 text-oc-text-primary"),
          )}
        >
          {l.text || " "}
        </div>
      ))}
    </div>
  );
}
