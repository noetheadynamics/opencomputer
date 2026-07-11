export type TaskQueueStatus =
  | "queued"
  | "running"
  | "awaiting_permission"
  | "completed"
  | "failed"
  | "abstained"
  | "cancelled";

export interface TaskQueueItem {
  id: string;
  prompt: string;
  status: TaskQueueStatus;
  category: number | null;
  iterations: number;
  toolCallsMade: number;
  startTime: number;
  endTime?: number;
  result?: string;
  error?: string;
  steps: TaskStep[];
}

export interface TaskStep {
  iteration: number;
  thought: string;
  plan: string;
  observations: TaskObservation[];
}

export interface TaskObservation {
  tool: string;
  success: boolean;
  error?: string;
  duration?: number;
}
