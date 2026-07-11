import { useState } from "react";
import { motion } from "framer-motion";
import {
  Power,
  Trash2,
  Settings,
  Play,
  Square,
  RotateCw,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import type { MCPServer } from "@/types/mcp";
import { MCPStatusIndicator } from "./MCPStatusIndicator";
import { MCPToolList } from "./MCPToolList";
import { MCPConfigModal } from "./MCPConfigModal";
import { MCPLogsView } from "./MCPLogsView";

const tapSpring = { type: "spring" as const, stiffness: 700, damping: 20 };

interface MCPCardProps {
  server: MCPServer;
  onToggle: (id: string, enabled: boolean) => void;
  onDelete: (id: string) => void;
  onStart: (id: string) => void;
  onStop: (id: string) => void;
  onRestart: (id: string) => void;
  onSave: (id: string, data: Record<string, unknown>) => void;
}

export function MCPCard({
  server,
  onToggle,
  onDelete,
  onStart,
  onStop,
  onRestart,
  onSave,
}: MCPCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [showConfig, setShowConfig] = useState(false);
  const [showLogs, setShowLogs] = useState(false);

  const isRunning = server.status === "running";
  const isInstalled = server.status === "installed" || isRunning || server.status === "stopped";

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-xl border border-oc-surface-border bg-oc-surface/40 p-4 transition-colors hover:border-oc-accent/20"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h4 className="truncate text-sm font-medium text-oc-text-primary">{server.name}</h4>
              <MCPStatusIndicator status={server.status} showLabel />
            </div>
            {server.package && (
              <p className="mt-0.5 truncate text-xs text-oc-text-secondary font-mono">{server.package}</p>
            )}
            {server.tools.length > 0 && (
              <p className="mt-1 text-xs text-oc-text-secondary">{server.tools.length} tool{server.tools.length !== 1 ? "s" : ""}</p>
            )}
          </div>

          <div className="flex shrink-0 items-center gap-1">
            {isInstalled && !isRunning && (
              <motion.button
                whileTap={{ scale: 0.9, transition: tapSpring }}
                onClick={() => onStart(server.id)}
                title="Start"
                className="rounded-lg bg-green-500/15 p-1.5 text-green-400 hover:bg-green-500/25"
              >
                <Play size={14} />
              </motion.button>
            )}
            {isRunning && (
              <>
                <motion.button
                  whileTap={{ scale: 0.9, transition: tapSpring }}
                  onClick={() => onStop(server.id)}
                  title="Stop"
                  className="rounded-lg bg-yellow-500/15 p-1.5 text-yellow-400 hover:bg-yellow-500/25"
                >
                  <Square size={14} />
                </motion.button>
                <motion.button
                  whileTap={{ scale: 0.9, transition: tapSpring }}
                  onClick={() => onRestart(server.id)}
                  title="Restart"
                  className="rounded-lg bg-oc-surface/60 p-1.5 text-oc-text-secondary hover:text-oc-accent"
                >
                  <RotateCw size={14} />
                </motion.button>
              </>
            )}
            <motion.button
              whileTap={{ scale: 0.9, transition: tapSpring }}
              onClick={() => setShowConfig(true)}
              title="Configure"
              className="rounded-lg bg-oc-surface/60 p-1.5 text-oc-text-secondary hover:text-oc-accent"
            >
              <Settings size={14} />
            </motion.button>
            <motion.button
              whileTap={{ scale: 0.9, transition: tapSpring }}
              onClick={() => onToggle(server.id, !server.enabled)}
              title={server.enabled ? "Disable" : "Enable"}
              className={`rounded-lg p-1.5 ${server.enabled ? "bg-green-500/15 text-green-400" : "bg-red-500/15 text-red-400"}`}
            >
              <Power size={14} />
            </motion.button>
            <motion.button
              whileTap={{ scale: 0.9, transition: tapSpring }}
              onClick={() => {
                if (window.confirm(`Remove "${server.name}"?`)) onDelete(server.id);
              }}
              title="Remove"
              className="rounded-lg bg-red-500/15 p-1.5 text-red-400 hover:bg-red-500/25"
            >
              <Trash2 size={14} />
            </motion.button>
          </div>
        </div>

        {/* Expandable sections */}
        <div className="mt-2 flex gap-2">
          {server.tools.length > 0 && (
            <button
              onClick={() => setExpanded(!expanded)}
              className="flex items-center gap-1 text-xs text-oc-text-secondary hover:text-oc-accent"
            >
              {expanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
              Tools
            </button>
          )}
          <button
            onClick={() => setShowLogs(!showLogs)}
            className="flex items-center gap-1 text-xs text-oc-text-secondary hover:text-oc-accent"
          >
            {showLogs ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
            Logs
          </button>
        </div>

        {expanded && server.tools.length > 0 && (
          <div className="mt-2">
            <MCPToolList tools={server.tools} />
          </div>
        )}

        {showLogs && (
          <div className="mt-2">
            <MCPLogsView logs={server.logs} />
          </div>
        )}
      </motion.div>

      <MCPConfigModal
        isOpen={showConfig}
        server={server}
        onClose={() => setShowConfig(false)}
        onSave={onSave}
      />
    </>
  );
}
