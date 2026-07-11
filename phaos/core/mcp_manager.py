"""MCP manager — start/stop/restart MCP server subprocesses."""

from __future__ import annotations

import logging
import os
import subprocess
import sys
import threading
from typing import Any, List, Optional, Tuple

logger = logging.getLogger(__name__)


class MCPManager:
    """Manage running MCP server subprocesses."""

    def __init__(self, registry: Any):
        self.registry = registry
        self._processes: dict[str, subprocess.Popen] = {}
        self._logs: dict[str, list[str]] = {}
        self._lock = threading.Lock()

    def start_server(self, server_id: str) -> Tuple[bool, str]:
        server = self.registry.get_server(server_id)
        if not server:
            return False, "Server not found"
        if not server["enabled"]:
            return False, "Server is disabled"
        with self._lock:
            if server_id in self._processes:
                proc = self._processes[server_id]
                if proc.poll() is None:
                    return False, "Server is already running"
                del self._processes[server_id]

        cmd = self._build_command(server)
        if not cmd:
            return False, "Cannot determine command to run"

        env = os.environ.copy()
        env.update(server.get("env_vars", {}))

        try:
            creation_flags = 0
            if sys.platform == "win32":
                creation_flags = subprocess.CREATE_NO_WINDOW
            process = subprocess.Popen(
                cmd,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                env=env,
                text=True,
                creationflags=creation_flags,
            )
            with self._lock:
                self._processes[server_id] = process
                self._logs[server_id] = []
            self.registry.set_status(server_id, "running")
            return True, f"Started {server['name']}"
        except FileNotFoundError:
            return False, f"Command not found: {cmd[0]}"
        except Exception as e:
            logger.error("Failed to start MCP server %s: %s", server_id, e)
            return False, str(e)

    def stop_server(self, server_id: str) -> Tuple[bool, str]:
        with self._lock:
            if server_id not in self._processes:
                return False, "Server is not running"
            process = self._processes[server_id]

        try:
            process.terminate()
            try:
                process.wait(timeout=5)
            except subprocess.TimeoutExpired:
                process.kill()
                process.wait(timeout=3)
            with self._lock:
                del self._processes[server_id]
            self.registry.set_status(server_id, "stopped")
            return True, "Stopped successfully"
        except Exception as e:
            logger.error("Failed to stop MCP server %s: %s", server_id, e)
            with self._lock:
                self._processes.pop(server_id, None)
            return False, str(e)

    def restart_server(self, server_id: str) -> Tuple[bool, str]:
        stop_ok, stop_msg = self.stop_server(server_id)
        if not stop_ok and stop_msg != "Server is not running":
            return False, f"Stop failed: {stop_msg}"
        return self.start_server(server_id)

    def get_status(self, server_id: str) -> str:
        with self._lock:
            if server_id in self._processes:
                proc = self._processes[server_id]
                if proc.poll() is None:
                    return "running"
                del self._processes[server_id]
        server = self.registry.get_server(server_id)
        if not server:
            return "not_found"
        return server.get("status", "unknown")

    def get_logs(self, server_id: str) -> List[str]:
        with self._lock:
            if server_id in self._logs:
                return list(self._logs[server_id])
        return []

    def _build_command(self, server: dict) -> List[str] | None:
        install_type = server.get("install_type", "npm")
        if install_type == "npm":
            package = server.get("package", "")
            if not package:
                return None
            return ["npx", "-y", package]
        elif install_type == "pip":
            package = server.get("package", "")
            if not package:
                return None
            return [sys.executable, "-m", package]
        elif install_type == "custom":
            command = server.get("command", "")
            if not command:
                return None
            args = server.get("args", [])
            return [command] + (args if isinstance(args, list) else [])
        return None

    def stop_all(self) -> None:
        with self._lock:
            server_ids = list(self._processes.keys())
        for sid in server_ids:
            self.stop_server(sid)
