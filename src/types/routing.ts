/**
 * Model routing types for OpenComputer.
 */

export interface RouteRule {
  id: string;
  task_type: string;
  provider_id: string;
  model_name: string;
  fallback_provider_id: string;
  fallback_model_name: string;
  created_at: string;
  updated_at: string;
}
