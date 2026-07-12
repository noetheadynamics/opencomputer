import * as React from "react";
import { Download, CheckCircle, RefreshCw, ChevronDown, ChevronUp, ExternalLink } from "lucide-react";
import {
  checkForUpdates,
  getCurrentVersion,
  downloadAndInstallUpdate,
  type UpdateInfo,
  type UpdateProgress,
} from "@/lib/updater";
import { cn } from "@/lib/utils";

export function UpdatePanel() {
  const [currentVersion, setCurrentVersion] = React.useState("...");
  const [updateInfo, setUpdateInfo] = React.useState<UpdateInfo | null>(null);
  const [checking, setChecking] = React.useState(false);
  const [downloading, setDownloading] = React.useState(false);
  const [progress, setProgress] = React.useState<UpdateProgress | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [showNotes, setShowNotes] = React.useState(false);
  const [installed, setInstalled] = React.useState(false);

  // Load current version on mount
  React.useEffect(() => {
    getCurrentVersion().then(setCurrentVersion).catch(() => {});
  }, []);

  // Listen for progress events from Tauri
  React.useEffect(() => {
    let unlisten: (() => void) | undefined;

    async function setupListener() {
      try {
        const { listen } = await import("@tauri-apps/api/event");
        unlisten = await listen<UpdateProgress>("update-progress", (event) => {
          setProgress(event.payload);
          if (event.payload.percent >= 100 && event.payload.status.includes("restart")) {
            setDownloading(false);
            setInstalled(true);
          }
        });
      } catch {
        // Not in Tauri — ignore
      }
    }

    setupListener();
    return () => { unlisten?.(); };
  }, []);

  async function handleCheck() {
    setChecking(true);
    setError(null);
    setUpdateInfo(null);
    setInstalled(false);
    try {
      const info = await checkForUpdates();
      setUpdateInfo(info);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to check for updates");
    } finally {
      setChecking(false);
    }
  }

  async function handleInstall() {
    if (!updateInfo?.download_url) return;
    setDownloading(true);
    setProgress(null);
    setError(null);
    try {
      await downloadAndInstallUpdate(updateInfo.download_url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to install update");
      setDownloading(false);
    }
  }

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-oc-text-primary">Updates</h3>
        <span className="text-xs text-oc-text-secondary font-mono">v{currentVersion}</span>
      </div>

      <div className="oc-glass-panel rounded-xl p-4 space-y-3">
        {/* Current version */}
        <div className="flex items-center justify-between text-sm">
          <span className="text-oc-text-secondary">Current version</span>
          <span className="text-oc-text-primary font-mono">{currentVersion}</span>
        </div>

        {/* Check button */}
        {!updateInfo && !downloading && !installed && (
          <button
            type="button"
            onClick={handleCheck}
            disabled={checking}
            className={cn(
              "oc-glass-btn w-full flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium transition-colors",
              checking
                ? "opacity-50 cursor-not-allowed"
                : "hover:bg-oc-surface/80",
            )}
          >
            <RefreshCw size={14} className={cn(checking && "animate-spin")} />
            {checking ? "Checking..." : "Check for Updates"}
          </button>
        )}

        {/* Up to date */}
        {updateInfo && !updateInfo.available && !downloading && (
          <div className="flex items-center gap-2 rounded-xl bg-oc-accent/10 px-3 py-2.5 text-sm text-oc-accent">
            <CheckCircle size={14} />
            You're up to date
          </div>
        )}

        {/* Update available */}
        {updateInfo && updateInfo.available && !downloading && !installed && (
          <>
            <div className="flex items-center justify-between rounded-xl bg-oc-accent/10 px-3 py-2.5">
              <div className="flex items-center gap-2 text-sm text-oc-accent">
                <Download size={14} />
                <span>
                  v{updateInfo.version} available
                </span>
              </div>
              {updateInfo.url && (
                <a
                  href={updateInfo.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-oc-text-secondary hover:text-oc-text-primary transition-colors"
                >
                  <ExternalLink size={12} />
                </a>
              )}
            </div>

            {/* Release notes */}
            {updateInfo.release_notes && (
              <div className="space-y-1">
                <button
                  type="button"
                  onClick={() => setShowNotes(!showNotes)}
                  className="flex items-center gap-1 text-xs text-oc-text-secondary hover:text-oc-text-primary transition-colors"
                >
                  {showNotes ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                  Release notes
                </button>
                {showNotes && (
                  <div className="max-h-40 overflow-y-auto rounded-lg bg-black/20 p-3 text-xs text-oc-text-secondary whitespace-pre-wrap leading-relaxed">
                    {updateInfo.release_notes}
                  </div>
                )}
              </div>
            )}

            {/* Install button */}
            <button
              type="button"
              onClick={handleInstall}
              className="oc-glass-btn oc-glass-btn-primary w-full flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium"
            >
              <Download size={14} />
              Install Update
            </button>
          </>
        )}

        {/* Downloading / installing progress */}
        {downloading && progress && (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-oc-text-secondary">{progress.status}</span>
              <span className="text-oc-text-primary font-mono">{progress.percent}%</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-oc-surface">
              <div
                className="h-full rounded-full bg-oc-accent transition-all duration-300"
                style={{ width: `${progress.percent}%` }}
              />
            </div>
          </div>
        )}

        {downloading && !progress && (
          <div className="flex items-center gap-2 text-sm text-oc-text-secondary">
            <RefreshCw size={14} className="animate-spin" />
            Preparing download...
          </div>
        )}

        {/* Installed — restart needed */}
        {installed && (
          <div className="space-y-2">
            <div className="flex items-center gap-2 rounded-xl bg-oc-accent/10 px-3 py-2.5 text-sm text-oc-accent">
              <CheckCircle size={14} />
              Update installed — restart to apply
            </div>
            <button
              type="button"
              onClick={() => {
                // Ask user to restart manually — no process plugin needed
                window.location.reload();
              }}
              className="oc-glass-btn oc-glass-btn-primary w-full flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium"
            >
              <RefreshCw size={14} />
              Restart Now
            </button>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="rounded-xl bg-red-500/10 px-3 py-2.5 text-sm text-red-400">
            {error}
          </div>
        )}
      </div>
    </section>
  );
}
