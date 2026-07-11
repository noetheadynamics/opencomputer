import * as React from "react";
import { Plus, Trash2, GitBranch as GitBranchIcon } from "lucide-react";
import type { Branch } from "@/types/git";
import { cn } from "@/lib/utils";

interface BranchManagerProps {
  branches: Branch[];
  currentBranch: string;
  onCreateBranch: (name: string) => void;
  onSwitchBranch: (name: string) => void;
  onDeleteBranch: (name: string) => void;
  uncommittedChanges: boolean;
}

export function BranchManager({
  branches,
  onCreateBranch,
  onSwitchBranch,
  onDeleteBranch,
  uncommittedChanges,
}: BranchManagerProps) {
  const [newBranch, setNewBranch] = React.useState("");

  const handleCreate = React.useCallback(() => {
    const name = newBranch.trim();
    if (name) {
      onCreateBranch(name);
      setNewBranch("");
    }
  }, [newBranch, onCreateBranch]);

  const handleKeyDown = React.useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter") handleCreate();
    },
    [handleCreate],
  );

  return (
    <div className="space-y-3">
      <h4 className="text-xs font-medium text-oc-text-secondary">Branches</h4>

      <div className="flex gap-2">
        <input
          type="text"
          value={newBranch}
          onChange={(e) => setNewBranch(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="New branch name…"
          className="min-w-0 flex-1 rounded-xl border border-oc-surface-border bg-oc-bg/60 px-3 py-1.5 text-sm text-oc-text-primary placeholder-oc-text-secondary/50 outline-none transition-colors focus:border-oc-accent/40"
        />
        <button
          type="button"
          onClick={handleCreate}
          disabled={!newBranch.trim()}
          className="flex items-center gap-1 rounded-xl bg-oc-accent px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-oc-accent/90 disabled:opacity-40 dark:oc-glow-sm"
        >
          <Plus size={12} />
          Create
        </button>
      </div>

      <div className="space-y-1">
        {branches.map((branch) => (
          <div
            key={branch.name}
            className={cn(
              "group flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm transition-colors",
              branch.current
                ? "bg-oc-accent/10 text-oc-accent"
                : "text-oc-text-primary hover:bg-oc-surface/50",
            )}
          >
            <GitBranchIcon size={14} className="shrink-0" />
            <span className="flex-1 truncate">{branch.name}</span>
            {branch.current && (
              <span className="text-[10px] text-oc-accent">current</span>
            )}
            {!branch.current && (
              <>
                <button
                  type="button"
                  onClick={() => onSwitchBranch(branch.name)}
                  className="shrink-0 rounded p-1 text-oc-text-secondary opacity-0 transition-opacity hover:text-oc-accent group-hover:opacity-100"
                  title="Switch to this branch"
                >
                  <GitBranchIcon size={12} />
                </button>
                <button
                  type="button"
                  onClick={() => onDeleteBranch(branch.name)}
                  className="shrink-0 rounded p-1 text-oc-text-secondary opacity-0 transition-opacity hover:text-oc-danger group-hover:opacity-100"
                  title="Delete branch"
                >
                  <Trash2 size={12} />
                </button>
              </>
            )}
          </div>
        ))}
      </div>

      {uncommittedChanges && (
        <p className="text-[10px] text-yellow-400">
          You have uncommitted changes. Switching branches may cause conflicts.
        </p>
      )}
    </div>
  );
}
