import { useState, useCallback } from "react";
import { mcpApi } from "@/lib/mcp";

interface InstallState {
  serverId: string;
  status: "installing" | "success" | "error";
  message?: string;
}

export function useMCPInstall() {
  const [installs, setInstalls] = useState<InstallState[]>([]);

  const install = useCallback(async (serverId: string) => {
    setInstalls((prev) => [...prev, { serverId, status: "installing" }]);
    const result = await mcpApi.installServer(serverId);
    setInstalls((prev) =>
      prev.map((i) =>
        i.serverId === serverId
          ? { ...i, status: result.success ? "success" : "error", message: result.message }
          : i,
      ),
    );
    return result;
  }, []);

  const uninstall = useCallback(async (serverId: string) => {
    const result = await mcpApi.uninstallServer(serverId);
    setInstalls((prev) => prev.filter((i) => i.serverId !== serverId));
    return result;
  }, []);

  const isInstalling = useCallback(
    (serverId: string) => installs.some((i) => i.serverId === serverId && i.status === "installing"),
    [installs],
  );

  const getInstallState = useCallback(
    (serverId: string) => installs.find((i) => i.serverId === serverId),
    [installs],
  );

  return { installs, install, uninstall, isInstalling, getInstallState };
}
