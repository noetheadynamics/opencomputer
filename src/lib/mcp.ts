import type { MCPServer, MCPCatalogEntry, MCPServerCreate, MCPServerUpdate, MCPActionResponse } from "@/types/mcp";
import { PHAOS_BASE } from "./config";

let _serversCache: MCPServer[] | null = null;
let _catalogCache: MCPCatalogEntry[] | null = null;

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${PHAOS_BASE}${path}`, init);
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`API ${res.status}: ${text.slice(0, 200)}`);
  }
  return res.json();
}

export const mcpApi = {
  async getCatalog(): Promise<MCPCatalogEntry[]> {
    try {
      const data = await api<{ servers: MCPCatalogEntry[] }>("/api/mcp/catalog");
      _catalogCache = data.servers;
      return _catalogCache;
    } catch {
      return _catalogCache ?? [];
    }
  },

  async getServers(): Promise<MCPServer[]> {
    try {
      const data = await api<{ servers: MCPServer[] }>("/api/mcp/servers");
      _serversCache = data.servers;
      return _serversCache;
    } catch {
      return _serversCache ?? [];
    }
  },

  async getServer(id: string): Promise<MCPServer | null> {
    try {
      return await api<MCPServer>(`/api/mcp/servers/${id}`);
    } catch {
      return null;
    }
  },

  async createServer(data: MCPServerCreate): Promise<string | null> {
    try {
      const res = await api<{ id: string; success: boolean }>("/api/mcp/servers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      return res.id;
    } catch {
      return null;
    }
  },

  async updateServer(id: string, data: MCPServerUpdate): Promise<boolean> {
    try {
      await api(`/api/mcp/servers/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      return true;
    } catch {
      return false;
    }
  },

  async deleteServer(id: string): Promise<boolean> {
    try {
      await api(`/api/mcp/servers/${id}`, { method: "DELETE" });
      _serversCache = (_serversCache ?? []).filter((s) => s.id !== id);
      return true;
    } catch {
      return false;
    }
  },

  async installServer(id: string): Promise<MCPActionResponse> {
    try {
      return await api<MCPActionResponse>(`/api/mcp/servers/${id}/install`, { method: "POST" });
    } catch (e) {
      return { success: false, message: e instanceof Error ? e.message : "Install failed" };
    }
  },

  async uninstallServer(id: string): Promise<MCPActionResponse> {
    try {
      return await api<MCPActionResponse>(`/api/mcp/servers/${id}/uninstall`, { method: "POST" });
    } catch (e) {
      return { success: false, message: e instanceof Error ? e.message : "Uninstall failed" };
    }
  },

  async startServer(id: string): Promise<MCPActionResponse> {
    try {
      return await api<MCPActionResponse>(`/api/mcp/servers/${id}/start`, { method: "POST" });
    } catch (e) {
      return { success: false, message: e instanceof Error ? e.message : "Start failed" };
    }
  },

  async stopServer(id: string): Promise<MCPActionResponse> {
    try {
      return await api<MCPActionResponse>(`/api/mcp/servers/${id}/stop`, { method: "POST" });
    } catch (e) {
      return { success: false, message: e instanceof Error ? e.message : "Stop failed" };
    }
  },

  async restartServer(id: string): Promise<MCPActionResponse> {
    try {
      return await api<MCPActionResponse>(`/api/mcp/servers/${id}/restart`, { method: "POST" });
    } catch (e) {
      return { success: false, message: e instanceof Error ? e.message : "Restart failed" };
    }
  },

  async enableServer(id: string): Promise<boolean> {
    try {
      await api(`/api/mcp/servers/${id}/enable`, { method: "POST" });
      return true;
    } catch {
      return false;
    }
  },

  async disableServer(id: string): Promise<boolean> {
    try {
      await api(`/api/mcp/servers/${id}/disable`, { method: "POST" });
      return true;
    } catch {
      return false;
    }
  },

  async getServerTools(id: string): Promise<unknown[]> {
    try {
      const data = await api<{ tools: unknown[] }>(`/api/mcp/servers/${id}/tools`);
      return data.tools;
    } catch {
      return [];
    }
  },

  async getServerLogs(id: string): Promise<string[]> {
    try {
      const data = await api<{ logs: string[] }>(`/api/mcp/servers/${id}/logs`);
      return data.logs;
    } catch {
      return [];
    }
  },
};
