"""MCP tool discovery — query MCP servers for available tools."""

from __future__ import annotations

import json
import logging
import subprocess
import sys
from typing import Any, List

logger = logging.getLogger(__name__)


class MCPToolDiscovery:
    """Discover tools provided by MCP servers."""

    def __init__(self, registry: Any, manager: Any):
        self.registry = registry
        self.manager = manager

    def discover_tools(self, server_id: str) -> List[dict[str, Any]]:
        server = self.registry.get_server(server_id)
        if not server:
            return []

        if self.manager.get_status(server_id) != "running":
            return server.get("tools", [])

        cmd = self._build_list_command(server)
        if not cmd:
            return server.get("tools", [])

        try:
            result = subprocess.run(
                cmd,
                capture_output=True,
                text=True,
                timeout=15,
                shell=(sys.platform == "win32"),
            )
            if result.returncode == 0:
                tools = json.loads(result.stdout)
                self.registry.update_server(server_id, {"tools": tools})
                return tools
        except (subprocess.TimeoutExpired, json.JSONDecodeError, Exception) as e:
            logger.debug("Tool discovery failed for %s: %s", server_id, e)

        return server.get("tools", [])

    def refresh_all_tools(self) -> dict[str, List[dict[str, Any]]]:
        results = {}
        for server in self.registry.get_enabled_servers():
            if self.manager.get_status(server["id"]) == "running":
                results[server["id"]] = self.discover_tools(server["id"])
            else:
                results[server["id"]] = server.get("tools", [])
        return results

    def _build_list_command(self, server: dict) -> List[str] | None:
        install_type = server.get("install_type", "npm")
        package = server.get("package", "")
        if not package:
            return None
        if install_type == "npm":
            return ["npx", "-y", package, "--list-tools"]
        elif install_type == "pip":
            return [sys.executable, "-m", package, "--list-tools"]
        return None
