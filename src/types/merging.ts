/**
 * Model Merging types for OpenComputer.
 */

export interface MergeStrategy {
  id: string;
  name: string;
  description: string;
}

export interface TaskStrategy {
  task_type: string;
  strategy: string;
}

export interface StrategyScore {
  strategy: string;
  success_rate: number;
  avg_latency_ms: number;
  avg_tokens: number;
  total_records: number;
}

export interface MergePerformance {
  scores: StrategyScore[];
  records: MergeRecord[];
}

export interface MergeRecord {
  id: string;
  task_type: string;
  strategy_name: string;
  models: string;
  success: boolean;
  latency_ms: number;
  tokens_used: number;
  created_at: string;
}

export interface MergeStatus {
  enabled: boolean;
  merge_method: string;
  registered_models: string[];
  total_models: number;
  task_strategies: Record<string, string>;
  available_strategies: string[];
}
