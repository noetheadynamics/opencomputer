export type AuditAction =
  | "file_read"
  | "file_write"
  | "file_delete"
  | "file_create"
  | "terminal_command"
  | "git_push"
  | "git_pull"
  | "git_commit"
  | "git_branch"
  | "skill_execute"
  | "task_create"
  | "task_complete"
  | "permission_grant"
  | "permission_deny";

export type AuditOutcome = "executed" | "approved" | "rejected" | "failed";

export interface AuditLogEntry {
  id: string;
  timestamp: string;
  action: AuditAction;
  description: string;
  outcome: AuditOutcome;
  taskId: string | null;
  metadata: Record<string, unknown>;
}

export interface AuditLogFilters {
  action?: AuditAction;
  outcome?: AuditOutcome;
  dateFrom?: string;
  dateTo?: string;
  taskId?: string;
}
