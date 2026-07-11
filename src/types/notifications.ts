export type NotificationType =
  | "task_completed"
  | "task_failed"
  | "task_abstained"
  | "permission_required"
  | "cron_result"
  | "info";

export interface AppNotification {
  id: string;
  type: NotificationType;
  title: string;
  body: string;
  read: boolean;
  timestamp: number;
  actionPanel?: string;
  taskId?: string;
}

export interface NotificationPreferences {
  taskCompleted: boolean;
  taskFailed: boolean;
  permissionRequired: boolean;
  cronResult: boolean;
}
