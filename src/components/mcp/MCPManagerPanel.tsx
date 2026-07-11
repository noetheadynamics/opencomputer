import { useState } from "react";
import { motion } from "framer-motion";
import { Search, Plus, RefreshCw } from "lucide-react";
import { useMCP } from "@/hooks/useMCP";
import { MCPCard } from "./MCPCard";
import { MCPInstallModal } from "./MCPInstallModal";

const tapSpring = { type: "spring" as const, stiffness: 700, damping: 20 };

export function MCPManagerPanel() {
  const {
    servers,
    catalog,
    loading,
    refresh,
    installFromCatalog,
    toggleServer,
    deleteServer,
    startServer,
    stopServer,
    restartServer,
    updateServer,
  } = useMCP();

  const [search, setSearch] = useState("");
  const [tab, setTab] = useState<"installed" | "discover">("installed");
  const [showInstallModal, setShowInstallModal] = useState(false);

  const installedPackages = servers.map((s) => s.package).filter(Boolean);

  const filteredInstalled = servers.filter(
    (s) =>
      s.name.toLowerCase().includes(search.toLowerCase()) ||
      s.package.toLowerCase().includes(search.toLowerCase()),
  );

  const filteredCatalog = catalog.filter(
    (c) =>
      c.name.toLowerCase().includes(search.toLowerCase()) &&
      !installedPackages.includes(c.package),
  );

  return (
    <div className="flex h-full flex-col p-4">
      {/* Header */}
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-oc-text-primary">MCP & Plugin Manager</h2>
        <div className="flex gap-2">
          <motion.button
            whileTap={{ scale: 0.95, transition: tapSpring }}
            onClick={refresh}
            className="oc-glass-btn flex items-center gap-1.5 px-3 text-sm"
          >
            <RefreshCw size={14} />
          </motion.button>
          <motion.button
            whileTap={{ scale: 0.95, transition: tapSpring }}
            onClick={() => setShowInstallModal(true)}
            className="oc-glass-btn-primary flex items-center gap-1.5 px-3 text-sm"
          >
            <Plus size={14} />
            Add
          </motion.button>
        </div>
      </div>

      {/* Search + Tabs */}
      <div className="mb-4 flex gap-2">
        <div className="oc-glass-input flex flex-1 items-center gap-2">
          <Search size={14} className="text-oc-text-secondary" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search MCP servers..."
            className="w-full bg-transparent text-sm text-oc-text-primary outline-none placeholder:text-oc-text-secondary/50"
          />
        </div>
        <div className="flex gap-1 rounded-xl bg-oc-surface/50 p-1">
          <button
            onClick={() => setTab("installed")}
            className={`rounded-lg px-3 py-1 text-xs font-medium transition-colors ${
              tab === "installed"
                ? "bg-oc-accent text-white"
                : "text-oc-text-secondary hover:text-oc-text-primary"
            }`}
          >
            Installed ({servers.length})
          </button>
          <button
            onClick={() => setTab("discover")}
            className={`rounded-lg px-3 py-1 text-xs font-medium transition-colors ${
              tab === "discover"
                ? "bg-oc-accent text-white"
                : "text-oc-text-secondary hover:text-oc-text-primary"
            }`}
          >
            Discover ({filteredCatalog.length})
          </button>
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex flex-1 items-center justify-center text-sm text-oc-text-secondary">
          Loading...
        </div>
      ) : tab === "installed" ? (
        filteredInstalled.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center text-oc-text-secondary">
            <p className="text-sm">No MCP servers installed.</p>
            <button
              onClick={() => setTab("discover")}
              className="mt-2 text-sm text-oc-accent hover:underline"
            >
              Browse available servers
            </button>
          </div>
        ) : (
          <div className="flex-1 space-y-2 overflow-y-auto pr-1">
            {filteredInstalled.map((server) => (
              <MCPCard
                key={server.id}
                server={server}
                onToggle={toggleServer}
                onDelete={deleteServer}
                onStart={startServer}
                onStop={stopServer}
                onRestart={restartServer}
                onSave={updateServer}
              />
            ))}
          </div>
        )
      ) : filteredCatalog.length === 0 ? (
        <div className="flex flex-1 items-center justify-center text-sm text-oc-text-secondary">
          All available servers are already installed.
        </div>
      ) : (
        <div className="flex-1 space-y-2 overflow-y-auto pr-1">
          {filteredCatalog.map((entry) => (
            <motion.div
              key={entry.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex items-center justify-between rounded-xl border border-oc-surface-border bg-oc-surface/40 p-4 transition-colors hover:border-oc-accent/20"
            >
              <div className="flex items-center gap-3 min-w-0">
                <span className="text-2xl">{entry.icon}</span>
                <div className="min-w-0">
                  <h4 className="truncate text-sm font-medium text-oc-text-primary">{entry.name}</h4>
                  <p className="truncate text-xs text-oc-text-secondary">{entry.description}</p>
                  <p className="mt-0.5 truncate text-xs text-oc-text-secondary font-mono">{entry.package}</p>
                </div>
              </div>
              <motion.button
                whileTap={{ scale: 0.95, transition: tapSpring }}
                onClick={() => installFromCatalog(entry)}
                className="oc-glass-btn-primary shrink-0 px-3 py-1.5 text-xs"
              >
                Install
              </motion.button>
            </motion.div>
          ))}
        </div>
      )}

      <MCPInstallModal
        isOpen={showInstallModal}
        catalog={catalog}
        installedPackages={installedPackages}
        onClose={() => setShowInstallModal(false)}
        onSuccess={refresh}
      />
    </div>
  );
}
