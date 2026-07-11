import { motion } from "framer-motion";
import { Keyboard } from "lucide-react";
import { cn } from "@/lib/utils";

interface Shortcut {
  keys: string[];
  action: string;
}

const SHORTCUTS: Shortcut[] = [
  { keys: ["Ctrl", "K"], action: "Open command palette" },
  { keys: ["Ctrl", "N"], action: "New chat session" },
  { keys: ["Ctrl", "Enter"], action: "Send message" },
  { keys: ["Ctrl", "Shift", "F"], action: "Focus file browser search" },
  { keys: ["Ctrl", "`"], action: "Toggle terminal panel" },
  { keys: ["Ctrl", "Shift", "G"], action: "Toggle git panel" },
  { keys: ["Ctrl", ","], action: "Open Settings" },
  { keys: ["Ctrl", "Shift", "T"], action: "Toggle light/dark theme" },
  { keys: ["Ctrl", "B"], action: "Toggle sidebar" },
  { keys: ["Esc"], action: "Close active modal/dialog" },
  { keys: ["Ctrl", "Shift", "A"], action: "Open Security Audit Log" },
];

function KeyBadge({ keyName }: { keyName: string }) {
  return (
    <kbd
      className={cn(
        "inline-flex items-center justify-center rounded-lg",
        "border border-oc-surface-border bg-oc-surface/80 px-2 py-0.5",
        "font-mono text-xs text-oc-text-primary shadow-sm",
      )}
    >
      {keyName}
    </kbd>
  );
}

export function ShortcutsPanel() {
  return (
    <div className="flex h-full flex-col p-4">
      <div className="mb-4 flex items-center gap-2">
        <Keyboard size={18} className="text-oc-accent" />
        <h2 className="text-lg font-semibold text-oc-text-primary">
          Keyboard Shortcuts
        </h2>
      </div>

      <div className="flex-1 space-y-2 overflow-y-auto">
        {SHORTCUTS.map((shortcut) => (
          <motion.div
            key={shortcut.action}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            className="flex items-center justify-between rounded-xl bg-oc-surface/30 px-4 py-3"
          >
            <span className="text-sm text-oc-text-primary">
              {shortcut.action}
            </span>
            <div className="flex items-center gap-1">
              {shortcut.keys.map((k, i) => (
                <span key={k} className="flex items-center gap-1">
                  {i > 0 && (
                    <span className="text-[10px] text-oc-text-secondary">+</span>
                  )}
                  <KeyBadge keyName={k} />
                </span>
              ))}
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
