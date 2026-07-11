import { useState } from "react";
import { motion } from "framer-motion";
import { X, Download } from "lucide-react";
import type { MCPCatalogEntry } from "@/types/mcp";
import { mcpApi } from "@/lib/mcp";

const tapSpring = { type: "spring" as const, stiffness: 700, damping: 20 };

interface MCPInstallModalProps {
  isOpen: boolean;
  catalog: MCPCatalogEntry[];
  installedPackages: string[];
  onClose: () => void;
  onSuccess: () => void;
}

export function MCPInstallModal({
  isOpen,
  catalog,
  installedPackages,
  onClose,
  onSuccess,
}: MCPInstallModalProps) {
  const [name, setName] = useState("");
  const [pkg, setPkg] = useState("");
  const [installType, setInstallType] = useState<"npm" | "pip" | "custom">("npm");
  const [command, setCommand] = useState("");
  const [args, setArgs] = useState("");
  const [envVars, setEnvVars] = useState("");
  const [installing, setInstalling] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  async function handleInstall(entry?: MCPCatalogEntry) {
    setInstalling(true);
    setMsg(null);

    let result;
    if (entry) {
      result = await mcpApi.createServer({
        name: entry.name,
        package: entry.package,
        install_type: entry.install_type,
      });
      if (result) {
        const installResult = await mcpApi.installServer(result);
        setMsg(installResult.success ? `Installed ${entry.name}` : installResult.message ?? "Failed");
      }
    } else {
      const envParsed: Record<string, string> = {};
      if (envVars.trim()) {
        for (const line of envVars.split("\n")) {
          const [k, ...rest] = line.split("=");
          if (k) envParsed[k.trim()] = rest.join("=").trim();
        }
      }
      const argsParsed = args.split(",").map((a) => a.trim()).filter(Boolean);
      result = await mcpApi.createServer({
        name: name || "Custom MCP Server",
        package: pkg,
        install_type: installType,
        command,
        args: argsParsed,
        env_vars: envParsed,
      });
      setMsg(result ? "Server added" : "Failed to add server");
    }

    setInstalling(false);
    if (result) {
      onSuccess();
      setTimeout(() => { onClose(); setMsg(null); }, 800);
    }
  }

  const available = catalog.filter((c) => !installedPackages.includes(c.package));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="oc-glass-modal w-full max-w-lg max-h-[80vh] overflow-y-auto p-6"
      >
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-oc-text-primary">Add MCP Server</h3>
          <button onClick={onClose} className="text-oc-text-secondary hover:text-oc-text-primary">
            <X size={18} />
          </button>
        </div>

        {/* Catalog */}
        {available.length > 0 && (
          <div className="mb-6">
            <h4 className="mb-2 text-sm font-medium text-oc-text-secondary">Popular Servers</h4>
            <div className="grid grid-cols-2 gap-2">
              {available.map((entry) => (
                <motion.button
                  key={entry.id}
                  whileTap={{ scale: 0.95, transition: tapSpring }}
                  onClick={() => handleInstall(entry)}
                  disabled={installing}
                  className="flex items-center gap-2 rounded-xl bg-oc-surface/60 p-3 text-left hover:bg-oc-surface transition-colors"
                >
                  <span className="text-xl">{entry.icon}</span>
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-oc-text-primary truncate">{entry.name}</div>
                    <div className="text-xs text-oc-text-secondary truncate">{entry.description}</div>
                  </div>
                </motion.button>
              ))}
            </div>
          </div>
        )}

        {/* Custom form */}
        <div className="border-t border-oc-surface-border pt-4">
          <h4 className="mb-2 text-sm font-medium text-oc-text-secondary">Custom Server</h4>
          <div className="space-y-3">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Server name"
              className="oc-glass-input w-full text-sm"
            />
            <div className="flex gap-2">
              <select
                value={installType}
                onChange={(e) => setInstallType(e.target.value as "npm" | "pip" | "custom")}
                className="oc-glass-input w-28 text-sm"
              >
                <option value="npm">npm</option>
                <option value="pip">pip</option>
                <option value="custom">custom</option>
              </select>
              <input
                value={pkg}
                onChange={(e) => setPkg(e.target.value)}
                placeholder={installType === "custom" ? "Package (optional)" : "Package name"}
                className="oc-glass-input flex-1 text-sm"
              />
            </div>
            {installType === "custom" && (
              <input
                value={command}
                onChange={(e) => setCommand(e.target.value)}
                placeholder="Command (e.g. /usr/bin/mcp-server)"
                className="oc-glass-input w-full text-sm"
              />
            )}
            <input
              value={args}
              onChange={(e) => setArgs(e.target.value)}
              placeholder="Args (comma-separated)"
              className="oc-glass-input w-full text-sm"
            />
            <textarea
              value={envVars}
              onChange={(e) => setEnvVars(e.target.value)}
              placeholder={"Environment variables\nKEY=value\nTOKEN=xxx"}
              rows={3}
              className="oc-glass-input w-full text-sm resize-none"
            />
            <motion.button
              whileTap={{ scale: 0.95, transition: tapSpring }}
              onClick={() => handleInstall()}
              disabled={installing || (!pkg && installType !== "custom")}
              className="oc-glass-btn-primary flex w-full items-center justify-center gap-2 py-2 text-sm disabled:opacity-50"
            >
              <Download size={14} />
              {installing ? "Installing..." : "Add Server"}
            </motion.button>
          </div>
        </div>

        {msg && (
          <div className="mt-3 rounded-xl bg-oc-accent/10 px-3 py-2 text-xs text-oc-accent">{msg}</div>
        )}
      </motion.div>
    </div>
  );
}
