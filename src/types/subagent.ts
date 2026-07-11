/**
 * Subagent Manager types.
 */

export interface SubagentConfig {
  id: string;
  name: string;
  task_type: string;
  system_prompt: string;
  model: string;
  tools: string[];
  enabled: boolean;
  created_at: string;
  updated_at: string;
}

export interface SubagentCreateRequest {
  name: string;
  task_type?: string;
  system_prompt?: string;
  model?: string;
  tools?: string[];
  enabled?: boolean;
}

export interface SubagentTestResult {
  success: boolean;
  response?: string;
  error?: string;
  subagent?: string;
}

export const TASK_TYPES = [
  'coding', 'vision', 'reasoning', 'factual', 'design', 'search', 'file_ops', 'custom',
] as const;

export const AVAILABLE_TOOLS = [
  'read_file', 'write_file', 'edit_file', 'list_directory', 'search_files',
  'run_terminal', 'run_code', 'web_search', 'web_scrape', 'git_operations',
  'create_task', 'manage_tasks', 'memory_store', 'memory_retrieve',
] as const;
