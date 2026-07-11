import { ArrowUp, ArrowDown, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface PushPullControlsProps {
  ahead: number;
  behind: number;
  onPush: () => void;
  onPull: () => void;
  isPushing: boolean;
  isPulling: boolean;
}

export function PushPullControls({
  ahead,
  behind,
  onPush,
  onPull,
  isPushing,
  isPulling,
}: PushPullControlsProps) {
  return (
    <div className="space-y-3">
      <h4 className="text-xs font-medium text-oc-text-secondary">
        Remote Sync
      </h4>

      <div className="flex items-center gap-3">
        <div className="flex items-center gap-1.5 text-xs text-oc-text-secondary">
          <ArrowUp size={12} className="text-oc-accent" />
          <span>{ahead} ahead</span>
        </div>
        <div className="flex items-center gap-1.5 text-xs text-oc-text-secondary">
          <ArrowDown size={12} className="text-yellow-400" />
          <span>{behind} behind</span>
        </div>
      </div>

      <div className="flex gap-2">
        <button
          type="button"
          onClick={onPush}
          disabled={isPushing || ahead === 0}
          className={cn(
            "flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-oc-accent/30 px-3 py-2 text-xs font-medium text-oc-accent transition-colors hover:bg-oc-accent/10 disabled:opacity-40",
          )}
        >
          {isPushing ? (
            <Loader2 size={12} className="animate-spin" />
          ) : (
            <ArrowUp size={12} />
          )}
          {isPushing ? "Pushing…" : "Push"}
        </button>

        <button
          type="button"
          onClick={onPull}
          disabled={isPulling}
          className={cn(
            "flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-oc-surface-border px-3 py-2 text-xs font-medium text-oc-text-secondary transition-colors hover:bg-oc-surface hover:text-oc-text-primary disabled:opacity-40",
          )}
        >
          {isPulling ? (
            <Loader2 size={12} className="animate-spin" />
          ) : (
            <ArrowDown size={12} />
          )}
          {isPulling ? "Pulling…" : "Pull"}
        </button>
      </div>
    </div>
  );
}
