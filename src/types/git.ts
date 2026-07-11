export type FileStatusType = "added" | "modified" | "deleted" | "renamed" | "untracked";

export interface FileStatus {
  path: string;
  status: FileStatusType;
  staged: boolean;
}

export interface GitStatus {
  branch: string;
  staged: FileStatus[];
  unstaged: FileStatus[];
  untracked: FileStatus[];
  ahead: number;
  behind: number;
  isRepo: boolean;
}

export interface Branch {
  name: string;
  current: boolean;
}

export interface CommitResult {
  hash: string;
  message: string;
}

export interface DiffResult {
  filePath: string;
  diff: string;
}
