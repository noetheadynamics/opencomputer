import { isTauri } from "@/lib/storage";
import type {
  GitStatus,
  Branch,
  CommitResult,
  DiffResult,
} from "@/types/git";

/* ------------------------------------------------------------------ */
/* Tauri invoke wrapper                                               */
/* ------------------------------------------------------------------ */

async function invoke<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
  if (isTauri()) {
    const { invoke: tauriInvoke } = await import("@tauri-apps/api/core");
    return tauriInvoke<T>(cmd, args);
  }
  throw new Error("Git operations require a native environment (Tauri)");
}

/* ------------------------------------------------------------------ */
/* Public API                                                          */
/* ------------------------------------------------------------------ */

export async function getStatus(projectRoot: string): Promise<GitStatus> {
  return invoke<GitStatus>("git_status", { project_root: projectRoot });
}

export async function stageFiles(
  files: string[],
  projectRoot: string,
): Promise<void> {
  await invoke("git_stage", { files, project_root: projectRoot });
}

export async function unstageFiles(
  files: string[],
  projectRoot: string,
): Promise<void> {
  await invoke("git_unstage", { files, project_root: projectRoot });
}

export async function commitChanges(
  message: string,
  projectRoot: string,
): Promise<CommitResult> {
  return invoke<CommitResult>("git_commit", {
    message,
    project_root: projectRoot,
  });
}

export async function pushChanges(
  projectRoot: string,
): Promise<string> {
  return invoke<string>("git_push", {
    remote: "origin",
    branch: "current",
    project_root: projectRoot,
  });
}

export async function pullChanges(
  projectRoot: string,
): Promise<string> {
  return invoke<string>("git_pull", {
    remote: "origin",
    branch: "current",
    project_root: projectRoot,
  });
}

export async function getBranches(projectRoot: string): Promise<Branch[]> {
  return invoke<Branch[]>("git_branches", { project_root: projectRoot });
}

export async function createBranch(
  name: string,
  projectRoot: string,
): Promise<void> {
  await invoke("git_create_branch", { name, project_root: projectRoot });
}

export async function switchBranch(
  name: string,
  projectRoot: string,
): Promise<void> {
  await invoke("git_switch_branch", { name, project_root: projectRoot });
}

export async function deleteBranch(
  name: string,
  projectRoot: string,
): Promise<void> {
  await invoke("git_delete_branch", { name, project_root: projectRoot });
}

export async function getFileDiff(
  filePath: string,
  projectRoot: string,
): Promise<DiffResult> {
  const diff = await invoke<string>("git_diff", {
    file_path: filePath,
    project_root: projectRoot,
  });
  return { filePath, diff };
}
