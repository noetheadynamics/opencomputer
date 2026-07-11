import * as React from "react";
import { RefreshCw, GitBranch as GitBranchIcon, Loader2 } from "lucide-react";
import { useGit } from "@/hooks/useGit";
import { StatusView } from "./StatusView";
import { CommitComposer } from "./CommitComposer";
import { BranchManager } from "./BranchManager";
import { PushPullControls } from "./PushPullControls";
import { DiffPreview } from "./DiffPreview";
import { GitConfirmationDialog } from "./GitConfirmationDialog";

interface GitPanelProps {
  projectRoot: string;
}

export function GitPanel({ projectRoot }: GitPanelProps) {
  const {
    status,
    branches,
    loading,
    error,
    pushing,
    pulling,
    committing,
    diffResult,
    refresh,
    stage,
    unstage,
    stageAll,
    unstageAll,
    commit,
    push,
    pull,
    createBranch,
    switchBranch,
    deleteBranch,
    viewDiff,
    clearDiff,
  } = useGit(projectRoot);

  const [confirmAction, setConfirmAction] = React.useState<{
    title: string;
    message: string;
    danger: boolean;
    action: () => void;
  } | null>(null);

  const handlePush = React.useCallback(() => {
    setConfirmAction({
      title: "Push to Remote",
      message: `This will push ${status.ahead} commit${status.ahead !== 1 ? "s" : ""} to origin/${status.branch}. This action cannot be undone.`,
      danger: false,
      action: async () => {
        await push();
      },
    });
  }, [status.ahead, status.branch, push]);

  const handleSwitchBranch = React.useCallback(
    (name: string) => {
      const hasChanges =
        status.staged.length > 0 ||
        status.unstaged.length > 0 ||
        status.untracked.length > 0;

      if (hasChanges) {
        setConfirmAction({
          title: "Switch Branch",
          message: `You have uncommitted changes. Switching to '${name}' may cause conflicts.`,
          danger: true,
          action: () => switchBranch(name),
        });
      } else {
        switchBranch(name);
      }
    },
    [status, switchBranch],
  );

  const handleDeleteBranch = React.useCallback(
    (name: string) => {
      setConfirmAction({
        title: "Delete Branch",
        message: `Are you sure you want to delete branch '${name}'? This cannot be undone.`,
        danger: true,
        action: () => deleteBranch(name),
      });
    },
    [deleteBranch],
  );

  const uncommittedCount =
    status.staged.length + status.unstaged.length + status.untracked.length;

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2">
        <div className="flex items-center gap-2">
          <GitBranchIcon size={14} className="text-oc-accent" />
          <h2 className="text-sm font-semibold text-oc-text-primary">Git</h2>
          {status.branch && (
            <span className="rounded-full bg-oc-accent/10 px-2 py-0.5 text-[10px] text-oc-accent">
              {status.branch}
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={refresh}
          disabled={loading}
          className="rounded-lg p-1.5 text-oc-text-secondary transition-colors hover:bg-oc-surface hover:text-oc-text-primary disabled:opacity-40"
          title="Refresh"
        >
          {loading ? (
            <Loader2 size={14} className="animate-spin" />
          ) : (
            <RefreshCw size={14} />
          )}
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="border-b border-oc-danger/20 bg-oc-danger/5 px-4 py-2 text-xs text-oc-danger">
          {error}
        </div>
      )}

      {/* Content */}
      <div className="min-h-0 flex-1 overflow-auto p-4">
        {!status.isRepo && !loading ? (
          <div className="flex flex-col items-center py-12 text-center">
            <GitBranchIcon size={32} className="mb-2 text-oc-text-secondary" />
            <p className="text-sm text-oc-text-secondary">
              Not a Git repository
            </p>
            <p className="mt-1 text-xs text-oc-text-secondary/60">
              Initialize a repository in {projectRoot} to use Git features.
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Status */}
            <StatusView
              staged={status.staged}
              unstaged={status.unstaged}
              untracked={status.untracked}
              onStageFile={(f) => stage([f])}
              onUnstageFile={(f) => unstage([f])}
              onStageAll={stageAll}
              onUnstageAll={unstageAll}
              onViewDiff={viewDiff}
            />

            {/* Divider */}
            {uncommittedCount > 0 && <hr className="border-oc-surface-border" />}

            {/* Commit Composer */}
            {status.staged.length > 0 && (
              <CommitComposer
                stagedFiles={status.staged.map((f) => f.path)}
                onCommit={commit}
                isCommitting={committing}
              />
            )}

            {/* Divider */}
            <hr className="border-oc-surface-border" />

            {/* Branch Manager */}
            <BranchManager
              branches={branches}
              currentBranch={status.branch}
              onCreateBranch={createBranch}
              onSwitchBranch={handleSwitchBranch}
              onDeleteBranch={handleDeleteBranch}
              uncommittedChanges={uncommittedCount > 0}
            />

            {/* Divider */}
            <hr className="border-oc-surface-border" />

            {/* Push/Pull */}
            <PushPullControls
              ahead={status.ahead}
              behind={status.behind}
              onPush={handlePush}
              onPull={pull}
              isPushing={pushing}
              isPulling={pulling}
            />
          </div>
        )}
      </div>

      {/* Diff Preview Modal */}
      <DiffPreview diffResult={diffResult} onClose={clearDiff} />

      {/* Confirmation Dialog */}
      <GitConfirmationDialog
        isOpen={confirmAction !== null}
        title={confirmAction?.title ?? ""}
        message={confirmAction?.message ?? ""}
        danger={confirmAction?.danger ?? false}
        onConfirm={() => {
          confirmAction?.action();
          setConfirmAction(null);
        }}
        onCancel={() => setConfirmAction(null)}
      />
    </div>
  );
}
