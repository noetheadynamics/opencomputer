"""MCP routes — API endpoints for MCP server management."""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from ..core.mcp_registry import MCPRegistry
from ..core.mcp_installer import MCPInstaller
from ..core.mcp_manager import MCPManager
from ..core.mcp_tool_discovery import MCPToolDiscovery

router = APIRouter(prefix="/mcp", tags=["mcp"])

_registry: MCPRegistry | None = None
_installer: MCPInstaller | None = None
_manager: MCPManager | None = None
_discovery: MCPToolDiscovery | None = None


def get_registry() -> MCPRegistry:
    global _registry
    if _registry is None:
        _registry = MCPRegistry()
    return _registry


def get_installer() -> MCPInstaller:
    global _installer
    if _installer is None:
        _installer = MCPInstaller()
    return _installer


def get_manager() -> MCPManager:
    global _manager
    if _manager is None:
        _manager = MCPManager(get_registry())
    return _manager


def get_discovery() -> MCPToolDiscovery:
    global _discovery
    if _discovery is None:
        _discovery = MCPToolDiscovery(get_registry(), get_manager())
    return _discovery


# ── Catalog ───────────────────────────────────────────────────────────

CATALOG = [
    {"id": "slack", "name": "Slack", "package": "@anthropic/mcp-server-slack", "install_type": "npm", "icon": "💬", "description": "Send/receive messages, manage channels"},
    {"id": "gmail", "name": "Gmail", "package": "@anthropic/mcp-server-gmail", "install_type": "npm", "icon": "📧", "description": "Search, read, send emails"},
    {"id": "notion", "name": "Notion", "package": "@anthropic/mcp-server-notion", "install_type": "npm", "icon": "📝", "description": "Full Notion API access"},
    {"id": "github", "name": "GitHub", "package": "@anthropic/mcp-server-github", "install_type": "npm", "icon": "🐙", "description": "Repo management, PRs, issues"},
    {"id": "whatsapp", "name": "WhatsApp", "package": "@anthropic/mcp-server-whatsapp", "install_type": "npm", "icon": "💬", "description": "Send/receive WhatsApp messages"},
    {"id": "telegram", "name": "Telegram", "package": "@anthropic/mcp-server-telegram", "install_type": "npm", "icon": "📱", "description": "Telegram bot integration"},
    {"id": "discord", "name": "Discord", "package": "@anthropic/mcp-server-discord", "install_type": "npm", "icon": "🎮", "description": "Discord bot integration"},
    {"id": "google-drive", "name": "Google Drive", "package": "@anthropic/mcp-server-gdrive", "install_type": "npm", "icon": "☁️", "description": "Read, search, manage files"},
    {"id": "jira", "name": "Jira", "package": "@anthropic/mcp-server-jira", "install_type": "npm", "icon": "📋", "description": "Jira project management"},
    {"id": "linear", "name": "Linear", "package": "@anthropic/mcp-server-linear", "install_type": "npm", "icon": "📊", "description": "Linear project management"},
    {"id": "postgres", "name": "PostgreSQL", "package": "@anthropic/mcp-server-postgres", "install_type": "npm", "icon": "🐘", "description": "PostgreSQL database access"},
    {"id": "playwright", "name": "Playwright", "package": "@anthropic/mcp-server-playwright", "install_type": "npm", "icon": "🎭", "description": "Browser automation"},
    {"id": "sqlite", "name": "SQLite", "package": "@anthropic/mcp-server-sqlite", "install_type": "npm", "icon": "💾", "description": "SQLite database access"},
    {"id": "filesystem", "name": "Filesystem", "package": "@anthropic/mcp-server-filesystem", "install_type": "npm", "icon": "📁", "description": "Local filesystem access"},
    {"id": "brave-search", "name": "Brave Search", "package": "@anthropic/mcp-server-brave-search", "install_type": "npm", "icon": "🔍", "description": "Web search via Brave API"},
]


class MCPServerCreate(BaseModel):
    name: str
    package: str = ""
    install_type: str = "npm"
    command: str = ""
    args: list[str] = []
    env_vars: dict[str, str] = {}
    enabled: bool = True


class MCPServerUpdate(BaseModel):
    name: str | None = None
    package: str | None = None
    install_type: str | None = None
    command: str | None = None
    args: list[str] | None = None
    env_vars: dict[str, str] | None = None
    enabled: bool | None = None


# ── Catalog ───────────────────────────────────────────────────────────

@router.get("/catalog")
async def get_catalog():
    return {"servers": CATALOG}


# ── Servers CRUD ──────────────────────────────────────────────────────

@router.get("/servers")
async def get_servers(registry: MCPRegistry = Depends(get_registry), manager: MCPManager = Depends(get_manager)):
    servers = registry.get_all_servers()
    for s in servers:
        s["status"] = manager.get_status(s["id"])
    return {"servers": servers}


@router.post("/servers")
async def create_server(data: MCPServerCreate, registry: MCPRegistry = Depends(get_registry)):
    server_id = registry.add_server(data.model_dump())
    return {"id": server_id, "success": True}


@router.get("/servers/{server_id}")
async def get_server(server_id: str, registry: MCPRegistry = Depends(get_registry), manager: MCPManager = Depends(get_manager)):
    server = registry.get_server(server_id)
    if not server:
        raise HTTPException(status_code=404, detail="Server not found")
    server["status"] = manager.get_status(server_id)
    return server


@router.put("/servers/{server_id}")
async def update_server(server_id: str, data: MCPServerUpdate, registry: MCPRegistry = Depends(get_registry)):
    updates = data.model_dump(exclude_none=True)
    success = registry.update_server(server_id, updates)
    if not success:
        raise HTTPException(status_code=404, detail="Server not found")
    return {"success": True}


@router.delete("/servers/{server_id}")
async def delete_server(server_id: str, registry: MCPRegistry = Depends(get_registry), manager: MCPManager = Depends(get_manager)):
    if manager.get_status(server_id) == "running":
        manager.stop_server(server_id)
    success = registry.delete_server(server_id)
    if not success:
        raise HTTPException(status_code=404, detail="Server not found")
    return {"success": True}


# ── Actions ───────────────────────────────────────────────────────────

@router.post("/servers/{server_id}/install")
async def install_server(server_id: str, registry: MCPRegistry = Depends(get_registry), installer: MCPInstaller = Depends(get_installer)):
    server = registry.get_server(server_id)
    if not server:
        raise HTTPException(status_code=404, detail="Server not found")

    install_type = server.get("install_type", "npm")
    package = server.get("package", "")

    if install_type == "custom":
        registry.set_status(server_id, "installed")
        return {"success": True, "message": "Custom server — manual installation required"}

    if not package:
        raise HTTPException(status_code=400, detail="No package specified")

    if install_type == "npm":
        success, message = installer.install_npm(package)
    elif install_type == "pip":
        success, message = installer.install_pip(package)
    else:
        return {"success": False, "message": f"Unknown install type: {install_type}"}

    if success:
        registry.set_status(server_id, "installed")
    return {"success": success, "message": message}


@router.post("/servers/{server_id}/uninstall")
async def uninstall_server(server_id: str, registry: MCPRegistry = Depends(get_registry), installer: MCPInstaller = Depends(get_installer)):
    server = registry.get_server(server_id)
    if not server:
        raise HTTPException(status_code=404, detail="Server not found")

    install_type = server.get("install_type", "npm")
    package = server.get("package", "")

    if install_type == "custom" or not package:
        registry.set_status(server_id, "not_installed")
        return {"success": True, "message": "Server removed"}

    if install_type == "npm":
        success, message = installer.uninstall_npm(package)
    elif install_type == "pip":
        success, message = installer.uninstall_pip(package)
    else:
        return {"success": False, "message": f"Unknown install type: {install_type}"}

    if success:
        registry.set_status(server_id, "not_installed")
    return {"success": success, "message": message}


@router.post("/servers/{server_id}/start")
async def start_server(server_id: str, manager: MCPManager = Depends(get_manager)):
    success, message = manager.start_server(server_id)
    return {"success": success, "message": message}


@router.post("/servers/{server_id}/stop")
async def stop_server(server_id: str, manager: MCPManager = Depends(get_manager)):
    success, message = manager.stop_server(server_id)
    return {"success": success, "message": message}


@router.post("/servers/{server_id}/restart")
async def restart_server(server_id: str, manager: MCPManager = Depends(get_manager)):
    success, message = manager.restart_server(server_id)
    return {"success": success, "message": message}


# ── Status / Tools / Logs ────────────────────────────────────────────

@router.get("/servers/{server_id}/status")
async def get_server_status(server_id: str, manager: MCPManager = Depends(get_manager)):
    status = manager.get_status(server_id)
    return {"status": status}


@router.get("/servers/{server_id}/tools")
async def get_server_tools(server_id: str, registry: MCPRegistry = Depends(get_registry)):
    server = registry.get_server(server_id)
    if not server:
        raise HTTPException(status_code=404, detail="Server not found")
    return {"tools": server.get("tools", [])}


@router.post("/servers/{server_id}/discover-tools")
async def discover_tools(server_id: str, discovery: MCPToolDiscovery = Depends(get_discovery)):
    tools = discovery.discover_tools(server_id)
    return {"tools": tools}


@router.get("/servers/{server_id}/logs")
async def get_server_logs(server_id: str, manager: MCPManager = Depends(get_manager)):
    logs = manager.get_logs(server_id)
    return {"logs": logs}


# ── Enable / Disable ─────────────────────────────────────────────────

@router.post("/servers/{server_id}/enable")
async def enable_server(server_id: str, registry: MCPRegistry = Depends(get_registry)):
    success = registry.update_server(server_id, {"enabled": True})
    if not success:
        raise HTTPException(status_code=404, detail="Server not found")
    return {"success": True}


@router.post("/servers/{server_id}/disable")
async def disable_server(server_id: str, registry: MCPRegistry = Depends(get_registry), manager: MCPManager = Depends(get_manager)):
    if manager.get_status(server_id) == "running":
        manager.stop_server(server_id)
    success = registry.update_server(server_id, {"enabled": False})
    if not success:
        raise HTTPException(status_code=404, detail="Server not found")
    return {"success": True}
