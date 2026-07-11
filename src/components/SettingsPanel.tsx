import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, Pencil, Server } from "lucide-react";
import { Modal } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ProviderForm } from "./ProviderForm";
import type { Provider } from "@/lib/providers";
import { cn } from "@/lib/utils";

interface SettingsPanelProps {
  open: boolean;
  onClose: () => void;
  providers: Provider[];
  activeId: string | null;
  onAdd: (p: Provider) => void;
  onUpdate: (p: Provider) => void;
  onDelete: (id: string) => void;
  onSelectActive: (id: string) => void;
}

export function SettingsPanel({
  open,
  onClose,
  providers,
  activeId,
  onAdd,
  onUpdate,
  onDelete,
  onSelectActive,
}: SettingsPanelProps) {
  const [editing, setEditing] = React.useState<Provider | null>(null);
  const [adding, setAdding] = React.useState(false);

  function close() {
    setEditing(null);
    setAdding(false);
    onClose();
  }

  function handleSave(p: Provider) {
    if (editing) onUpdate(p);
    else onAdd(p);
    setEditing(null);
    setAdding(false);
  }

  function handleDelete(id: string) {
    onDelete(id);
    setEditing(null);
  }

  return (
    <Modal open={open} onClose={close} title="Settings">
      <div className="space-y-4">
        <section>
          <div className="mb-2 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-oc-text-primary">
              Providers
            </h3>
            {!adding && !editing && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => setAdding(true)}
              >
                <Plus size={14} /> Add
              </Button>
            )}
          </div>

          {providers.length === 0 && !adding && !editing && (
            <div className="rounded-xl border border-dashed border-oc-surface-border px-4 py-6 text-center text-sm text-oc-text-secondary">
              No providers yet. Add an OpenAI-compatible endpoint to begin.
            </div>
          )}

          {!adding && !editing && (
            <ul className="space-y-2">
              {providers.map((p) => (
                <li key={p.id}>
                  <button
                    type="button"
                    onClick={() => onSelectActive(p.id)}
                    className={cn(
                      "flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition-colors",
                      p.id === activeId
                        ? "border-oc-accent bg-oc-accent/10"
                        : "border-oc-surface-border hover:border-oc-accent/50",
                    )}
                  >
                    <Server size={16} className="text-oc-text-secondary" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm text-oc-text-primary">
                        {p.label}
                      </span>
                      <span className="block truncate text-xs text-oc-text-secondary">
                        {p.model} · {p.baseUrl}
                      </span>
                    </span>
                    {p.id === activeId && (
                      <span className="text-xs text-oc-accent">active</span>
                    )}
                    <span
                      role="button"
                      tabIndex={0}
                      aria-label="Edit provider"
                      onClick={(e) => {
                        e.stopPropagation();
                        setEditing(p);
                      }}
                      className="rounded-lg p-1.5 text-oc-text-secondary transition-colors hover:bg-oc-surface hover:text-oc-text-primary"
                    >
                      <Pencil size={14} />
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        <AnimatePresence mode="wait">
          {(adding || editing) && (
            <motion.div
              key={editing?.id ?? "new"}
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden border-t border-oc-surface-border pt-4"
            >
              <h4 className="mb-3 text-xs font-medium uppercase tracking-wide text-oc-text-secondary">
                {editing ? "Edit provider" : "New provider"}
              </h4>
              <ProviderForm
                initial={editing ?? undefined}
                onSave={handleSave}
                onDelete={editing ? handleDelete : undefined}
              />
              <button
                type="button"
                onClick={() => {
                  setEditing(null);
                  setAdding(false);
                }}
                className="mt-3 text-xs text-oc-text-secondary hover:text-oc-text-primary"
              >
                Cancel
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </Modal>
  );
}
