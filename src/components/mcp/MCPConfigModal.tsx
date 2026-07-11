import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { X, Save } from "lucide-react";
import type { MCPServer } from "@/types/mcp";

const tapSpring = { type: "spring" as const, stiffness: 700, damping: 20 };

interface MCPConfigModalProps {
  isOpen: boolean;
  server: MCPServer | null;
  onClose: () => void;
  onSave: (id: string, data: Record<string, unknown>) => void;
}

export function MCPConfigModal({ isOpen, server, onClose, onSave }: MCPConfigModalProps) {
  const [envVars, setEnvVars] = useState("");
  const [args, setArgs] = useState("");

  useEffect(() => {
    if (server) {
      const vars = server.env_vars ?? {};
      setEnvVars(Object.entries(vars).map(([k, v]) => `${k}=${v}`).join("\n"));
      setArgs((server.args ?? []).join(", "));
    }
  }, [server]);

  if (!isOpen || !server) return null;

  function handleSave() {
    if (!server) return;
    const envParsed: Record<string, string> = {};
    for (const line of envVars.split("\n")) {
      const [k, ...rest] = line.split("=");
      if (k?.trim()) envParsed[k.trim()] = rest.join("=").trim();
    }
    const argsParsed = args.split(",").map((a) => a.trim()).filter(Boolean);
    onSave(server.id, { env_vars: envParsed, args: argsParsed });
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="oc-glass-modal w-full max-w-md p-6"
      >
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-oc-text-primary">Configure {server.name}</h3>
          <button onClick={onClose} className="text-oc-text-secondary hover:text-oc-text-primary">
            <X size={18} />
          </button>
        </div>

        <div className="space-y-3">
          <div>
            <label className="mb-1 block text-xs text-oc-text-secondary">Arguments</label>
            <input
              value={args}
              onChange={(e) => setArgs(e.target.value)}
              placeholder="arg1, arg2, --flag"
              className="oc-glass-input w-full text-sm"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-oc-text-secondary">Environment Variables</label>
            <textarea
              value={envVars}
              onChange={(e) => setEnvVars(e.target.value)}
              placeholder={"API_KEY=xxx\nTOKEN=yyy"}
              rows={5}
              className="oc-glass-input w-full text-sm resize-none font-mono"
            />
          </div>
        </div>

        <div className="mt-4 flex justify-end gap-2">
          <motion.button
            whileTap={{ scale: 0.95, transition: tapSpring }}
            onClick={onClose}
            className="oc-glass-btn px-4 py-1.5 text-sm"
          >
            Cancel
          </motion.button>
          <motion.button
            whileTap={{ scale: 0.95, transition: tapSpring }}
            onClick={handleSave}
            className="oc-glass-btn-primary flex items-center gap-1.5 px-4 py-1.5 text-sm"
          >
            <Save size={14} />
            Save
          </motion.button>
        </div>
      </motion.div>
    </div>
  );
}
