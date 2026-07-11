import { isTauri } from "@/lib/storage";
import type {
  GitStatus,
  FileStatus,
  Branch,
  CommitResult,
  DiffResult,
} from "@/types/git";

/* ------------------------------------------------------------------ */
/* Browser Mock — in-memory git simulation                             */
/* ------------------------------------------------------------------ */

interface MockFile {
  content: string;
  staged: boolean;
  tracked: boolean;
  status: "added" | "modified" | "deleted" | "renamed" | "untracked";
}

interface MockBranch {
  name: string;
  current: boolean;
}

interface MockRepo {
  files: Map<string, MockFile>;
  branches: MockBranch[];
  currentBranch: string;
  commits: Array<{ hash: string; message: string; files: string[] }>;
  log: string[];
}

let _repo: MockRepo | null = null;

function getRepo(): MockRepo {
  if (!_repo) {
    _repo = {
      files: new Map(),
      branches: [
        { name: "main", current: true },
      ],
      currentBranch: "main",
      commits: [],
      log: [],
    };
  }
  return _repo;
}

function logOp(operation: string, status: string, detail: string) {
  const repo = getRepo();
  const ts = Date.now();
  repo.log.push(`${ts} ${operation} ${status} ${detail}`);
}

function mockGitStatus(): GitStatus {
  const repo = getRepo();
  const staged: FileStatus[] = [];
  const unstaged: FileStatus[] = [];
  const untracked: FileStatus[] = [];

  for (const [path, file] of repo.files) {
    if (!file.tracked && !file.staged) {
      untracked.push({ path, status: "untracked", staged: false });
    } else if (file.staged) {
      staged.push({ path, status: file.status, staged: true });
    } else if (file.status === "modified") {
      unstaged.push({ path, status: "modified", staged: false });
    }
  }

  return {
    branch: repo.currentBranch,
    staged,
    unstaged,
    untracked,
    ahead: 0,
    behind: 0,
    isRepo: true,
  };
}

function mockGitStage(files: string[]): void {
  const repo = getRepo();
  if (files.length === 0) {
    // Stage all
    for (const [, file] of repo.files) {
      if (file.tracked && !file.staged) {
        file.staged = true;
      }
    }
    logOp("git_stage", "success", "stage-all");
  } else {
    for (const path of files) {
      const file = repo.files.get(path);
      if (file) {
        file.staged = true;
        logOp("git_stage", "success", path);
      }
    }
  }
}

function mockGitUnstage(files: string[]): void {
  const repo = getRepo();
  for (const path of files) {
    const file = repo.files.get(path);
    if (file) {
      file.staged = false;
      logOp("git_unstage", "success", path);
    }
  }
}

function mockGitCommit(message: string): CommitResult {
  const repo = getRepo();
  const hash = Math.random().toString(36).slice(2, 9);
  const files: string[] = [];

  for (const [path, file] of repo.files) {
    if (file.staged) {
      file.tracked = true;
      file.staged = false;
      file.status = "modified";
      files.push(path);
    }
  }

  repo.commits.push({ hash, message, files });
  logOp("git_commit", "success", `${hash} ${message}`);
  return { hash, message };
}

function mockGitPush(): string {
  logOp("git_push", "success", "origin " + getRepo().currentBranch);
  return `Pushed to origin/${getRepo().currentBranch}`;
}

function mockGitPull(): string {
  logOp("git_pull", "success", "origin " + getRepo().currentBranch);
  return `Pulled from origin/${getRepo().currentBranch}`;
}

function mockGitBranches(): Branch[] {
  const repo = getRepo();
  return repo.branches.map((b) => ({ name: b.name, current: b.current }));
}

function mockGitCreateBranch(name: string): void {
  const repo = getRepo();
  if (repo.branches.some((b) => b.name === name)) {
    throw new Error(`Branch '${name}' already exists`);
  }
  repo.branches.push({ name, current: false });
  logOp("git_create_branch", "success", name);
}

function mockGitSwitchBranch(name: string): void {
  const repo = getRepo();
  const branch = repo.branches.find((b) => b.name === name);
  if (!branch) {
    throw new Error(`Branch '${name}' not found`);
  }
  repo.branches.forEach((b) => (b.current = b.name === name));
  repo.currentBranch = name;
  logOp("git_switch_branch", "success", name);
}

function mockGitDeleteBranch(name: string): void {
  const repo = getRepo();
  if (name === repo.currentBranch) {
    throw new Error("Cannot delete the current branch");
  }
  const idx = repo.branches.findIndex((b) => b.name === name);
  if (idx === -1) {
    throw new Error(`Branch '${name}' not found`);
  }
  repo.branches.splice(idx, 1);
  logOp("git_delete_branch", "success", name);
}

function mockGitDiff(filePath: string): string {
  const file = getRepo().files.get(filePath);
  if (!file) return "";
  return `--- a/${filePath}\n+++ b/${filePath}\n@@ -1,1 +1,1 @@\n-${file.staged ? "old content" : file.content}\n+${file.content}`;
}

function mockReset(): void {
  _repo = null;
}

/* ------------------------------------------------------------------ */
/* Tauri + Browser API                                                 */
/* ------------------------------------------------------------------ */

async function invoke<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
  if (isTauri()) {
    const { invoke: tauriInvoke } = await import("@tauri-apps/api/core");
    return tauriInvoke<T>(cmd, args);
  }

  // Browser mock
  switch (cmd) {
    case "git_status":
      return mockGitStatus() as T;
    case "git_stage":
      mockGitStage((args?.files as string[]) || []);
      return undefined as T;
    case "git_unstage":
      mockGitUnstage((args?.files as string[]) || []);
      return undefined as T;
    case "git_commit":
      return mockGitCommit(args?.message as string) as T;
    case "git_push":
      return mockGitPush() as T;
    case "git_pull":
      return mockGitPull() as T;
    case "git_branches":
      return mockGitBranches() as T;
    case "git_create_branch":
      mockGitCreateBranch(args?.name as string);
      return undefined as T;
    case "git_switch_branch":
      mockGitSwitchBranch(args?.name as string);
      return undefined as T;
    case "git_delete_branch":
      mockGitDeleteBranch(args?.name as string);
      return undefined as T;
    case "git_diff":
      return mockGitDiff(args?.file_path as string) as T;
    default:
      throw new Error(`Unknown command: ${cmd}`);
  }
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

/** Reset mock state (for tests). */
export function resetMockGit(): void {
  mockReset();
}

/** Get audit log entries (for tests). */
export function getMockGitLog(): string[] {
  return getRepo().log;
}
