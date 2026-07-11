export interface MCPServer {
  id: string;
  name: string;
  package: string;
  install_type: "npm" | "pip" | "custom";
  command: string;
  args: string[];
  env_vars: Record<string, string>;
  enabled: boolean;
  status: "not_installed" | "installed" | "running" | "stopped" | "error";
  tools: MCPTool[];
  logs: string[];
  created_at: string;
  updated_at: string;
}

export interface MCPTool {
  name: string;
  description?: string;
  inputSchema?: Record<string, unknown>;
}

export interface MCPCatalogEntry {
  id: string;
  name: string;
  package: string;
  install_type: "npm" | "pip" | "custom";
  icon: string;
  description: string;
}

export interface MCPServerCreate {
  name: string;
  package?: string;
  install_type?: string;
  command?: string;
  args?: string[];
  env_vars?: Record<string, string>;
  enabled?: boolean;
}

export interface MCPServerUpdate {
  name?: string;
  package?: string;
  install_type?: string;
  command?: string;
  args?: string[];
  env_vars?: Record<string, string>;
  enabled?: boolean;
}

export interface MCPActionResponse {
  success: boolean;
  message?: string;
}
