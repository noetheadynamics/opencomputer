import * as React from "react";
import { Sparkles, GitCommit } from "lucide-react";
import { getHarnessConnection } from "@/lib/harness";
import { cn } from "@/lib/utils";

interface CommitComposerProps {
  stagedFiles: string[];
  onCommit: (message: string) => void;
  isCommitting: boolean;
}

export function CommitComposer({
  stagedFiles,
  onCommit,
  isCommitting,
}: CommitComposerProps) {
  const [message, setMessage] = React.useState("");
  const [suggesting, setSuggesting] = React.useState(false);

  const canCommit = stagedFiles.length > 0 && message.trim().length > 0 && !isCommitting;

  const handleSuggest = React.useCallback(async () => {
    setSuggesting(true);
    try {
      const harness = getHarnessConnection();
      const suggested = await harness.suggestCommitMessage(stagedFiles);
      setMessage(suggested);
    } catch {
      setMessage(`Update ${stagedFiles.length} file(s)`);
    } finally {
      setSuggesting(false);
    }
  }, [stagedFiles]);

  const handleSubmit = React.useCallback(() => {
    if (canCommit) {
      onCommit(message.trim());
      setMessage("");
    }
  }, [canCommit, message, onCommit]);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="text-xs font-medium text-oc-text-secondary">
          Commit Message
        </h4>
        <span className="text-[10px] text-oc-text-secondary">
          {message.length}/72
        </span>
      </div>

      <textarea
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        placeholder="Describe your changes..."
        rows={3}
        className="w-full resize-none rounded-xl border border-oc-surface-border bg-oc-bg/60 px-3 py-2 text-sm text-oc-text-primary placeholder-oc-text-secondary/50 outline-none transition-colors focus:border-oc-accent/40"
      />

      {stagedFiles.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {stagedFiles.map((f) => (
            <span
              key={f}
              className="rounded-full bg-oc-accent/10 px-2 py-0.5 text-[10px] text-oc-accent"
            >
              {f}
            </span>
          ))}
        </div>
      )}

      <div className="flex gap-2">
        <button
          type="button"
          onClick={handleSuggest}
          disabled={stagedFiles.length === 0 || suggesting}
          className={cn(
            "flex items-center gap-1.5 rounded-xl border border-oc-surface-border px-3 py-2 text-xs text-oc-text-secondary transition-colors hover:bg-oc-surface hover:text-oc-text-primary",
            (stagedFiles.length === 0 || suggesting) && "opacity-40",
          )}
        >
          <Sparkles size={12} className={suggesting ? "animate-pulse" : ""} />
          {suggesting ? "Suggesting…" : "Suggest Message"}
        </button>

        <button
          type="button"
          onClick={handleSubmit}
          disabled={!canCommit}
          className={cn(
            "flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-oc-accent px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-oc-accent/90 dark:oc-glow-sm",
            !canCommit && "opacity-40",
          )}
        >
          <GitCommit size={14} />
          {isCommitting ? "Committing…" : "Commit"}
        </button>
      </div>
    </div>
  );
}
