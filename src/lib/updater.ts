/**
 * Auto-update API for OpenComputer.
 * Wraps Tauri invoke calls for the updater backend.
 */

import { isTauri } from "./storage";

async function tauriInvoke<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
  const { invoke } = await import("@tauri-apps/api/core");
  return invoke<T>(cmd, args ?? {});
}

export interface UpdateInfo {
  available: boolean;
  version: string;
  url: string;
  download_url: string;
  release_notes: string | null;
}

export interface UpdateProgress {
  percent: number;
  status: string;
}

/** Check if a new version is available on GitHub. */
export async function checkForUpdates(): Promise<UpdateInfo> {
  if (!isTauri()) {
    return {
      available: false,
      version: "1.0.0",
      url: "",
      download_url: "",
      release_notes: null,
    };
  }
  return tauriInvoke<UpdateInfo>("check_for_updates");
}

/** Get the current app version from Cargo.toml. */
export async function getCurrentVersion(): Promise<string> {
  if (!isTauri()) return "1.0.0";
  return tauriInvoke<string>("get_current_version");
}

/** Get the current platform: "windows", "macos", or "linux". */
export async function getPlatform(): Promise<string> {
  if (!isTauri()) return "unknown";
  return tauriInvoke<string>("get_platform");
}

/** Download and silently install an update. Emits `update-progress` events. */
export async function downloadAndInstallUpdate(downloadUrl: string): Promise<string> {
  if (!isTauri()) {
    throw new Error("Updates require a native environment (Tauri)");
  }
  return tauriInvoke<string>("download_and_install_update", { downloadUrl });
}
