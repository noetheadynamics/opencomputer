/**
 * Memory types for OpenComputer — Truth Vault, Cross-Session State, Memory Store.
 */

export interface TruthVaultFact {
  id: string;
  query: string;
  answer: string;
  sources: string[];
  fact_type: string;
  created_at: string;
  expires_at: string;
  is_expired: boolean;
}

export interface CrossSessionState {
  milestones: string[];
  open_issues: string[];
  failed_attempts: string[];
  known_blockers: string[];
  skills_learned: string[];
  last_updated: string;
}

export interface MemoryInteraction {
  id: string;
  query: string;
  response: string;
  success: boolean;
  user_correction?: string;
  metadata?: string;
  timestamp: string;
}

export interface MemoryStats {
  truth_vault_count: number;
  cross_session_milestones: number;
  memory_store_count: number;
  conversations_count: number;
  skills_count: number;
  memory_store_details: {
    total: number;
    successful: number;
    failed: number;
    corrected: number;
  };
}

export interface CorrectionRequest {
  query: string;
  original_response: string;
  corrected_response: string;
}

export interface MessageFeedback {
  message_id: string;
  type: 'up' | 'down';
  created_at: string;
}
