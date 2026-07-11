/**
 * Harness management types for OpenComputer.
 */

export type HarnessStatus = 'active' | 'inactive' | 'error';

export interface Harness {
  id: string;
  name: string;
  version: string;
  description: string;
  entry_point: string;
  supports_file_tools: boolean;
  supports_terminal: boolean;
  supports_git: boolean;
  supports_cron: boolean;
  status: HarnessStatus;
  metadata: Record<string, unknown>;
}

export interface HarnessListResponse {
  harnesses: Harness[];
  active_harness: string | null;
  total_count: number;
}

export interface HarnessStatusResponse {
  active_harness: string | null;
  total_harnesses: number;
  harnesses: Array<{
    id: string;
    name: string;
    version: string;
    status: string;
  }>;
}

export interface HarnessInstallRequest {
  harness_id: string;
  name: string;
  version: string;
  description: string;
  entry_point: string;
  supports_file_tools?: boolean;
  supports_terminal?: boolean;
  supports_git?: boolean;
  supports_cron?: boolean;
  metadata?: Record<string, unknown>;
}

export interface HarnessActivateRequest {
  harness_id: string;
}
