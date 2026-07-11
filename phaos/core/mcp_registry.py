"""MCP server registry — CRUD operations for MCP servers stored in SQLite."""

from __future__ import annotations

import json
import os
import sqlite3
import threading
import uuid
from datetime import datetime, timezone
from typing import Any, Optional

_DB_PATH = os.getenv("PHAOS_MCP_DB_PATH", "./phaos_data.db")


class MCPRegistry:
    """CRUD for MCP servers backed by SQLite."""

    def __init__(self, db_path: str | None = None, db=None):
        self._external_db = db
        self._db_path = db_path or _DB_PATH
        self._lock = threading.Lock()
        if db is None:
            self._conn = sqlite3.connect(self._db_path, check_same_thread=False)
            self._conn.row_factory = sqlite3.Row
            self._conn.execute("PRAGMA journal_mode=WAL;")
            self._ensure_table()
        else:
            self._conn = None

    def _get_conn(self):
        if self._conn is not None:
            return self._conn
        return self._external_db.conn

    def _ensure_table(self):
        self._conn.execute("""
            CREATE TABLE IF NOT EXISTS mcp_servers (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                package TEXT DEFAULT '',
                install_type TEXT DEFAULT 'npm',
                command TEXT DEFAULT '',
                args TEXT DEFAULT '[]',
                env_vars TEXT DEFAULT '{}',
                enabled INTEGER DEFAULT 1,
                status TEXT DEFAULT 'not_installed',
                tools TEXT DEFAULT '[]',
                logs TEXT DEFAULT '[]',
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            )
        """)
        self._conn.commit()

    def add_server(self, data: dict[str, Any]) -> str:
        server_id = uuid.uuid4().hex[:12]
        now = datetime.now(timezone.utc).isoformat()
        conn = self._get_conn()
        with self._lock:
            conn.execute(
                """INSERT INTO mcp_servers
                   (id, name, package, install_type, command, args, env_vars,
                    enabled, status, tools, logs, created_at, updated_at)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                (
                    server_id,
                    data["name"],
                    data.get("package", ""),
                    data.get("install_type", "npm"),
                    data.get("command", ""),
                    json.dumps(data.get("args", [])),
                    json.dumps(data.get("env_vars", {})),
                    1 if data.get("enabled", True) else 0,
                    data.get("status", "not_installed"),
                    json.dumps(data.get("tools", [])),
                    json.dumps(data.get("logs", [])),
                    now,
                    now,
                ),
            )
            conn.commit()
        return server_id

    def get_server(self, server_id: str) -> Optional[dict[str, Any]]:
        conn = self._get_conn()
        row = conn.execute(
            "SELECT * FROM mcp_servers WHERE id = ?", (server_id,)
        ).fetchone()
        return self._row_to_dict(row) if row else None

    def get_all_servers(self) -> list[dict[str, Any]]:
        conn = self._get_conn()
        rows = conn.execute("SELECT * FROM mcp_servers ORDER BY name").fetchall()
        return [self._row_to_dict(r) for r in rows]

    def get_enabled_servers(self) -> list[dict[str, Any]]:
        conn = self._get_conn()
        rows = conn.execute(
            "SELECT * FROM mcp_servers WHERE enabled = 1 ORDER BY name"
        ).fetchall()
        return [self._row_to_dict(r) for r in rows]

    def update_server(self, server_id: str, data: dict[str, Any]) -> bool:
        allowed = {"name", "package", "install_type", "command", "args", "env_vars",
                    "enabled", "status", "tools", "logs"}
        updates = {}
        for k, v in data.items():
            if k not in allowed:
                continue
            if k in ("args", "env_vars", "tools", "logs") and isinstance(v, (list, dict)):
                updates[k] = json.dumps(v)
            elif k == "enabled":
                updates[k] = 1 if v else 0
            else:
                updates[k] = v
        if not updates:
            return False
        updates["updated_at"] = datetime.now(timezone.utc).isoformat()
        set_clause = ", ".join(f"{k} = ?" for k in updates)
        values = list(updates.values()) + [server_id]
        conn = self._get_conn()
        with self._lock:
            cursor = conn.execute(
                f"UPDATE mcp_servers SET {set_clause} WHERE id = ?", tuple(values)
            )
            conn.commit()
        return cursor.rowcount > 0

    def delete_server(self, server_id: str) -> bool:
        conn = self._get_conn()
        with self._lock:
            cursor = conn.execute(
                "DELETE FROM mcp_servers WHERE id = ?", (server_id,)
            )
            conn.commit()
        return cursor.rowcount > 0

    def set_status(self, server_id: str, status: str, tools: list[str] | None = None) -> bool:
        data: dict[str, Any] = {"status": status}
        if tools is not None:
            data["tools"] = tools
        return self.update_server(server_id, data)

    def _row_to_dict(self, row) -> dict[str, Any]:
        d = dict(row)
        for field in ("args", "env_vars", "tools", "logs"):
            if field in d and isinstance(d[field], str):
                try:
                    d[field] = json.loads(d[field])
                except (json.JSONDecodeError, TypeError):
                    pass
        d["enabled"] = bool(d.get("enabled", 0))
        return d

    def close(self):
        if self._conn is not None:
            self._conn.close()
