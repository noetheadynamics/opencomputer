/**
 * Performance monitoring types for OpenComputer.
 */

export interface PerformanceSummary {
  total_calls: number;
  total_tokens: number;
  avg_latency: number;
  success_rate: number;
}

export interface PerformanceRecord {
  id: string;
  session_id: string;
  provider: string;
  model: string;
  task_type: string;
  tokens_in: number;
  tokens_out: number;
  latency_ms: number;
  success: number;
  timestamp: string;
}

export interface SessionPerformance {
  session_id: string;
  summary: PerformanceSummary;
  by_model: Record<string, { calls: number; tokens: number }>;
  by_task: Record<string, { calls: number; tokens: number }>;
}
