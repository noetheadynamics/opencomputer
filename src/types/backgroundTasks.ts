/**
 * Background task types for OpenComputer.
 */

export interface BackgroundTask {
  id: string;
  session_id: string;
  task_type: string;
  payload: string;
  status: 'queued' | 'running' | 'paused' | 'completed' | 'failed' | 'cancelled';
  priority: number;
  progress: number;
  result: string | null;
  error: string | null;
  created_at: string;
  updated_at: string;
}

export interface TaskCreateRequest {
  session_id: string;
  task_type: string;
  payload?: Record<string, unknown>;
  priority?: number;
}
