"""Tests for MCP Manager — Phase 15."""

from __future__ import annotations

import json
import os
import sqlite3
import sys
import tempfile
from unittest.mock import MagicMock, patch

import pytest
from fastapi.testclient import TestClient

from phaos.core.mcp_registry import MCPRegistry
from phaos.core.mcp_installer import MCPInstaller
from phaos.core.mcp_manager import MCPManager
from phaos.core.mcp_tool_discovery import MCPToolDiscovery


# ── Fixtures ──────────────────────────────────────────────────────────


@pytest.fixture
def tmp_db_path(tmp_path):
    return str(tmp_path / "test_mcp.db")


@pytest.fixture
def registry(tmp_db_path):
    reg = MCPRegistry(db_path=tmp_db_path)
    yield reg
    reg.close()


@pytest.fixture
def installer():
    return MCPInstaller()


@pytest.fixture
def manager(registry):
    return MCPManager(registry)


@pytest.fixture
def discovery(registry, manager):
    return MCPToolDiscovery(registry, manager)


@pytest.fixture
def sample_data():
    return {
        "name": "Test MCP Server",
        "package": "@anthropic/mcp-server-test",
        "install_type": "npm",
        "command": "",
        "args": [],
        "env_vars": {"API_KEY": "test-key"},
        "enabled": True,
    }


# ── MCPRegistry Tests ────────────────────────────────────────────────


class TestMCPRegistry:

    def test_add_server(self, registry, sample_data):
        sid = registry.add_server(sample_data)
        assert sid is not None
        assert len(sid) == 12

    def test_get_server(self, registry, sample_data):
        sid = registry.add_server(sample_data)
        server = registry.get_server(sid)
        assert server is not None
        assert server["name"] == "Test MCP Server"
        assert server["package"] == "@anthropic/mcp-server-test"
        assert server["install_type"] == "npm"
        assert server["enabled"] is True
        assert server["status"] == "not_installed"
        assert isinstance(server["tools"], list)
        assert isinstance(server["env_vars"], dict)

    def test_get_all_servers(self, registry, sample_data):
        registry.add_server(sample_data)
        registry.add_server({**sample_data, "name": "Server 2"})
        servers = registry.get_all_servers()
        assert len(servers) == 2

    def test_get_enabled_servers(self, registry, sample_data):
        registry.add_server(sample_data)
        registry.add_server({**sample_data, "name": "Disabled", "enabled": False})
        enabled = registry.get_enabled_servers()
        assert len(enabled) == 1
        assert enabled[0]["name"] == "Test MCP Server"

    def test_update_server(self, registry, sample_data):
        sid = registry.add_server(sample_data)
        ok = registry.update_server(sid, {"name": "Updated Name", "env_vars": {"NEW": "val"}})
        assert ok is True
        server = registry.get_server(sid)
        assert server["name"] == "Updated Name"
        assert server["env_vars"]["NEW"] == "val"

    def test_update_server_invalid_field(self, registry, sample_data):
        sid = registry.add_server(sample_data)
        ok = registry.update_server(sid, {"id": "hacked", "name": "ok"})
        assert ok is True
        server = registry.get_server(sid)
        assert server["id"] == sid

    def test_delete_server(self, registry, sample_data):
        sid = registry.add_server(sample_data)
        ok = registry.delete_server(sid)
        assert ok is True
        assert registry.get_server(sid) is None

    def test_delete_nonexistent(self, registry):
        ok = registry.delete_server("nonexistent")
        assert ok is False

    def test_set_status(self, registry, sample_data):
        sid = registry.add_server(sample_data)
        ok = registry.set_status(sid, "running", tools=["tool1", "tool2"])
        assert ok is True
        server = registry.get_server(sid)
        assert server["status"] == "running"
        assert server["tools"] == ["tool1", "tool2"]

    def test_get_nonexistent(self, registry):
        assert registry.get_server("nope") is None

    def test_update_no_valid_fields(self, registry, sample_data):
        sid = registry.add_server(sample_data)
        ok = registry.update_server(sid, {"invalid_field": "value"})
        assert ok is False


# ── MCPInstaller Tests ───────────────────────────────────────────────


class TestMCPInstaller:

    def test_init(self, installer):
        assert isinstance(installer.npm_available, bool)
        assert isinstance(installer.pip_available, bool)

    @patch("subprocess.run")
    def test_install_npm_success(self, mock_run, installer):
        mock_run.return_value = MagicMock(returncode=0, stderr="", stdout="")
        ok, msg = installer.install_npm("test-package")
        assert ok is True
        assert "successfully" in msg.lower()

    @patch("subprocess.run")
    def test_install_npm_failure(self, mock_run, installer):
        mock_run.return_value = MagicMock(returncode=1, stderr="ERR not found", stdout="")
        ok, msg = installer.install_npm("bad-package")
        assert ok is False
        assert "ERR" in msg or "not found" in msg

    @patch("subprocess.run")
    def test_install_pip_success(self, mock_run, installer):
        mock_run.return_value = MagicMock(returncode=0, stderr="", stdout="")
        ok, msg = installer.install_pip("test-package")
        assert ok is True

    @patch("subprocess.run")
    def test_install_timeout(self, mock_run, installer):
        import subprocess
        mock_run.side_effect = subprocess.TimeoutExpired(cmd="npm", timeout=120)
        ok, msg = installer.install_npm("test-package")
        assert ok is False
        assert "timed out" in msg.lower()

    @patch("subprocess.run")
    def test_uninstall_npm(self, mock_run, installer):
        mock_run.return_value = MagicMock(returncode=0, stderr="", stdout="")
        ok, msg = installer.uninstall_npm("test-package")
        assert ok is True

    @patch("subprocess.run")
    def test_uninstall_pip(self, mock_run, installer):
        mock_run.return_value = MagicMock(returncode=0, stderr="", stdout="")
        ok, msg = installer.uninstall_pip("test-package")
        assert ok is True

    @patch("subprocess.run")
    def test_is_installed_npm(self, mock_run, installer):
        mock_run.return_value = MagicMock(returncode=0, stderr="", stdout="")
        assert installer.is_installed_npm("test-pkg") is True

    @patch("subprocess.run")
    def test_is_installed_pip(self, mock_run, installer):
        mock_run.return_value = MagicMock(returncode=0, stderr="", stdout="")
        assert installer.is_installed_pip("test-pkg") is True


# ── MCPManager Tests ─────────────────────────────────────────────────


class TestMCPManager:

    def test_start_nonexistent(self, manager):
        ok, msg = manager.start_server("nonexistent")
        assert ok is False
        assert "not found" in msg.lower()

    def test_start_disabled(self, registry, manager, sample_data):
        sid = registry.add_server({**sample_data, "enabled": False})
        ok, msg = manager.start_server(sid)
        assert ok is False
        assert "disabled" in msg.lower()

    def test_stop_not_running(self, manager):
        ok, msg = manager.stop_server("nonexistent")
        assert ok is False
        assert "not running" in msg.lower()

    def test_get_status_nonexistent(self, manager):
        assert manager.get_status("nonexistent") == "not_found"

    def test_get_status_installed(self, registry, manager, sample_data):
        sid = registry.add_server(sample_data)
        assert manager.get_status(sid) == "not_installed"

    def test_build_command_npm(self, manager):
        server = {"install_type": "npm", "package": "test-pkg", "command": "", "args": []}
        cmd = manager._build_command(server)
        assert cmd == ["npx", "-y", "test-pkg"]

    def test_build_command_pip(self, manager):
        server = {"install_type": "pip", "package": "test-pkg", "command": "", "args": []}
        cmd = manager._build_command(server)
        assert "python" in cmd[0].lower()
        assert "test-pkg" in cmd

    def test_build_command_custom(self, manager):
        server = {"install_type": "custom", "command": "/usr/bin/foo", "args": ["--flag"], "package": ""}
        cmd = manager._build_command(server)
        assert cmd == ["/usr/bin/foo", "--flag"]

    def test_build_command_npm_no_package(self, manager):
        server = {"install_type": "npm", "package": "", "command": "", "args": []}
        assert manager._build_command(server) is None

    def test_build_command_pip_no_package(self, manager):
        server = {"install_type": "pip", "package": "", "command": "", "args": []}
        assert manager._build_command(server) is None

    def test_build_command_custom_no_command(self, manager):
        server = {"install_type": "custom", "command": "", "args": [], "package": ""}
        assert manager._build_command(server) is None

    def test_build_command_unknown_type(self, manager):
        server = {"install_type": "unknown", "package": "x", "command": "", "args": []}
        assert manager._build_command(server) is None

    def test_stop_all(self, registry, manager, sample_data):
        sid = registry.add_server(sample_data)
        manager.stop_all()
        assert manager.get_status(sid) != "running"

    def test_logs_empty(self, manager):
        logs = manager.get_logs("nonexistent")
        assert logs == []

    def test_restart_nonexistent(self, manager):
        ok, msg = manager.restart_server("nonexistent")
        assert ok is False


# ── MCPToolDiscovery Tests ──────────────────────────────────────────


class TestMCPToolDiscovery:

    def test_discover_tools_not_running(self, registry, discovery, sample_data):
        sid = registry.add_server(sample_data)
        tools = discovery.discover_tools(sid)
        assert tools == []

    def test_discover_tools_nonexistent(self, discovery):
        tools = discovery.discover_tools("nonexistent")
        assert tools == []

    def test_discover_tools_with_existing(self, registry, discovery, sample_data):
        sid = registry.add_server({**sample_data, "tools": [{"name": "tool1"}]})
        tools = discovery.discover_tools(sid)
        assert len(tools) == 1

    def test_refresh_all_tools(self, registry, discovery, sample_data):
        registry.add_server(sample_data)
        results = discovery.refresh_all_tools()
        assert len(results) == 1


# ── API Route Tests ──────────────────────────────────────────────────


class TestMCPRoutes:

    @pytest.fixture
    def client(self, tmp_db_path):
        from fastapi import FastAPI
        from phaos.core.mcp_registry import MCPRegistry
        from phaos.core.mcp_manager import MCPManager
        from phaos.routes.mcp import router, get_registry, get_manager

        app = FastAPI()
        app.include_router(router)

        reg = MCPRegistry(db_path=tmp_db_path)
        mgr = MCPManager(reg)

        def override_registry():
            return reg

        def override_manager():
            return mgr

        app.dependency_overrides[get_registry] = override_registry
        app.dependency_overrides[get_manager] = override_manager

        yield TestClient(app), reg
        reg.close()

    def _clean(self, reg):
        for s in reg.get_all_servers():
            reg.delete_server(s["id"])

    def test_get_catalog(self, client):
        c, reg = client
        self._clean(reg)
        r = c.get("/mcp/catalog")
        assert r.status_code == 200
        data = r.json()
        assert "servers" in data
        assert len(data["servers"]) > 5

    def test_create_server(self, client):
        c, reg = client
        self._clean(reg)
        r = c.post("/mcp/servers", json={
            "name": "My Server",
            "package": "test-pkg",
            "install_type": "npm",
        })
        assert r.status_code == 200
        data = r.json()
        assert data["success"] is True
        assert "id" in data

    def test_get_servers(self, client):
        c, reg = client
        self._clean(reg)
        reg.add_server({"name": "S1", "package": "p1", "install_type": "npm"})
        r = c.get("/mcp/servers")
        assert r.status_code == 200
        assert len(r.json()["servers"]) == 1

    def test_get_server_by_id(self, client):
        c, reg = client
        self._clean(reg)
        sid = reg.add_server({"name": "S1", "package": "p1", "install_type": "npm"})
        r = c.get(f"/mcp/servers/{sid}")
        assert r.status_code == 200
        assert r.json()["name"] == "S1"

    def test_get_server_not_found(self, client):
        c, _ = client
        r = c.get("/mcp/servers/nonexistent")
        assert r.status_code == 404

    def test_update_server(self, client):
        c, reg = client
        self._clean(reg)
        sid = reg.add_server({"name": "S1", "package": "p1", "install_type": "npm"})
        r = c.put(f"/mcp/servers/{sid}", json={"name": "Updated"})
        assert r.status_code == 200
        assert r.json()["success"] is True

    def test_update_server_not_found(self, client):
        c, _ = client
        r = c.put("/mcp/servers/nonexistent", json={"name": "X"})
        assert r.status_code == 404

    def test_delete_server(self, client):
        c, reg = client
        self._clean(reg)
        sid = reg.add_server({"name": "S1", "package": "p1", "install_type": "npm"})
        r = c.delete(f"/mcp/servers/{sid}")
        assert r.status_code == 200
        assert r.json()["success"] is True

    def test_delete_server_not_found(self, client):
        c, _ = client
        r = c.delete("/mcp/servers/nonexistent")
        assert r.status_code == 404

    def test_get_server_status(self, client):
        c, reg = client
        self._clean(reg)
        sid = reg.add_server({"name": "S1", "package": "p1", "install_type": "npm"})
        r = c.get(f"/mcp/servers/{sid}/status")
        assert r.status_code == 200
        assert "status" in r.json()

    def test_get_server_tools(self, client):
        c, reg = client
        self._clean(reg)
        sid = reg.add_server({"name": "S1", "package": "p1", "install_type": "npm", "tools": [{"name": "t1"}]})
        r = c.get(f"/mcp/servers/{sid}/tools")
        assert r.status_code == 200
        assert len(r.json()["tools"]) == 1

    def test_get_server_tools_not_found(self, client):
        c, _ = client
        r = c.get("/mcp/servers/nonexistent/tools")
        assert r.status_code == 404

    def test_get_server_logs(self, client):
        c, reg = client
        self._clean(reg)
        sid = reg.add_server({"name": "S1", "package": "p1", "install_type": "npm"})
        r = c.get(f"/mcp/servers/{sid}/logs")
        assert r.status_code == 200
        assert "logs" in r.json()

    def test_enable_server(self, client):
        c, reg = client
        self._clean(reg)
        sid = reg.add_server({"name": "S1", "package": "p1", "install_type": "npm", "enabled": False})
        r = c.post(f"/mcp/servers/{sid}/enable")
        assert r.status_code == 200
        assert reg.get_server(sid)["enabled"] is True

    def test_disable_server(self, client):
        c, reg = client
        self._clean(reg)
        sid = reg.add_server({"name": "S1", "package": "p1", "install_type": "npm", "enabled": True})
        r = c.post(f"/mcp/servers/{sid}/disable")
        assert r.status_code == 200
        assert reg.get_server(sid)["enabled"] is False

    def test_start_server(self, client):
        c, reg = client
        self._clean(reg)
        sid = reg.add_server({"name": "S1", "package": "p1", "install_type": "npm", "enabled": True})
        r = c.post(f"/mcp/servers/{sid}/start")
        assert r.status_code == 200

    def test_stop_server(self, client):
        c, reg = client
        self._clean(reg)
        sid = reg.add_server({"name": "S1", "package": "p1", "install_type": "npm"})
        r = c.post(f"/mcp/servers/{sid}/stop")
        assert r.status_code == 200

    def test_restart_server(self, client):
        c, reg = client
        self._clean(reg)
        sid = reg.add_server({"name": "S1", "package": "p1", "install_type": "npm"})
        r = c.post(f"/mcp/servers/{sid}/restart")
        assert r.status_code == 200
