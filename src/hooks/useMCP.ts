import { useState, useCallback, useEffect } from "react";
import type { MCPServer, MCPCatalogEntry } from "@/types/mcp";
import { mcpApi } from "@/lib/mcp";

export function useMCP() {
  const [servers, setServers] = useState<MCPServer[]>([]);
  const [catalog, setCatalog] = useState<MCPCatalogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [s, c] = await Promise.all([mcpApi.getServers(), mcpApi.getCatalog()]);
      setServers(s);
      setCatalog(c);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load MCP data");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const installFromCatalog = useCallback(async (entry: MCPCatalogEntry) => {
    const id = await mcpApi.createServer({
      name: entry.name,
      package: entry.package,
      install_type: entry.install_type,
    });
    if (id) {
      await mcpApi.installServer(id);
      await refresh();
    }
  }, [refresh]);

  const createCustom = useCallback(async (data: { name: string; package: string; install_type: string; command: string; args: string[]; env_vars: Record<string, string> }) => {
    const id = await mcpApi.createServer(data);
    if (id) await refresh();
    return id;
  }, [refresh]);

  const toggleServer = useCallback(async (id: string, enabled: boolean) => {
    const ok = enabled ? await mcpApi.enableServer(id) : await mcpApi.disableServer(id);
    if (ok) {
      setServers((prev) => prev.map((s) => (s.id === id ? { ...s, enabled } : s)));
    }
  }, []);

  const deleteServer = useCallback(async (id: string) => {
    const ok = await mcpApi.deleteServer(id);
    if (ok) {
      setServers((prev) => prev.filter((s) => s.id !== id));
    }
  }, []);

  const startServer = useCallback(async (id: string) => {
    await mcpApi.startServer(id);
    await refresh();
  }, [refresh]);

  const stopServer = useCallback(async (id: string) => {
    await mcpApi.stopServer(id);
    await refresh();
  }, [refresh]);

  const restartServer = useCallback(async (id: string) => {
    await mcpApi.restartServer(id);
    await refresh();
  }, [refresh]);

  const updateServer = useCallback(async (id: string, data: Record<string, unknown>) => {
    await mcpApi.updateServer(id, data);
    await refresh();
  }, [refresh]);

  return {
    servers,
    catalog,
    loading,
    error,
    refresh,
    installFromCatalog,
    createCustom,
    toggleServer,
    deleteServer,
    startServer,
    stopServer,
    restartServer,
    updateServer,
  };
}
