"""Subagent Manager — CRUD + testing for custom subagents."""

from __future__ import annotations

import json
import logging
import sqlite3
import uuid
from datetime import datetime, timezone
from typing import Any, Callable, Dict, List, Optional

logger = logging.getLogger(__name__)


class SubagentManager:
    """Manage custom subagent configurations in SQLite."""

    def __init__(self, db_conn: Optional[sqlite3.Connection] = None):
        self._db = db_conn
        self._model_callback: Optional[Callable] = None
        self._ensure_table()

    def set_model_callback(self, callback: Callable):
        self._model_callback = callback

    def _ensure_table(self):
        if self._db is None:
            return
        self._db.execute("""
            CREATE TABLE IF NOT EXISTS subagents (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                task_type TEXT NOT NULL DEFAULT 'custom',
                system_prompt TEXT DEFAULT '',
                model TEXT DEFAULT '',
                tools TEXT DEFAULT '[]',
                enabled INTEGER DEFAULT 1,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            )
        """)
        self._db.commit()

    def _row_to_dict(self, row: sqlite3.Row) -> Dict[str, Any]:
        d = dict(row)
        d["tools"] = json.loads(d.get("tools", "[]"))
        d["enabled"] = bool(d.get("enabled", 1))
        return d

    def create_subagent(self, data: Dict[str, Any]) -> str:
        subagent_id = uuid.uuid4().hex[:12]
        now = datetime.now(timezone.utc).isoformat()
        self._db.execute(
            """INSERT INTO subagents (id, name, task_type, system_prompt, model, tools, enabled, created_at, updated_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (
                subagent_id,
                data["name"],
                data.get("task_type", "custom"),
                data.get("system_prompt", ""),
                data.get("model", ""),
                json.dumps(data.get("tools", [])),
                1 if data.get("enabled", True) else 0,
                now,
                now,
            ),
        )
        self._db.commit()
        return subagent_id

    def get_all_subagents(self) -> List[Dict[str, Any]]:
        cursor = self._db.execute("SELECT * FROM subagents ORDER BY created_at DESC")
        return [self._row_to_dict(row) for row in cursor.fetchall()]

    def get_subagent(self, subagent_id: str) -> Optional[Dict[str, Any]]:
        cursor = self._db.execute("SELECT * FROM subagents WHERE id=?", (subagent_id,))
        row = cursor.fetchone()
        return self._row_to_dict(row) if row else None

    def update_subagent(self, subagent_id: str, data: Dict[str, Any]) -> bool:
        existing = self.get_subagent(subagent_id)
        if not existing:
            return False
        updates = []
        params = []
        for key in ("name", "task_type", "system_prompt", "model", "enabled"):
            if key in data:
                updates.append(f"{key}=?")
                val = data[key]
                if key == "enabled":
                    val = 1 if val else 0
                params.append(val)
        if "tools" in data:
            updates.append("tools=?")
            params.append(json.dumps(data["tools"]))
        if updates:
            updates.append("updated_at=?")
            params.append(datetime.now(timezone.utc).isoformat())
            params.append(subagent_id)
            self._db.execute(f"UPDATE subagents SET {', '.join(updates)} WHERE id=?", params)
            self._db.commit()
        return True

    def delete_subagent(self, subagent_id: str) -> bool:
        cursor = self._db.execute("DELETE FROM subagents WHERE id=?", (subagent_id,))
        self._db.commit()
        return cursor.rowcount > 0

    def toggle_subagent(self, subagent_id: str, enabled: bool) -> bool:
        return self.update_subagent(subagent_id, {"enabled": enabled})

    def test_subagent(self, subagent_id: str, query: str) -> Dict[str, Any]:
        subagent = self.get_subagent(subagent_id)
        if not subagent:
            return {"success": False, "error": "Subagent not found"}
        if not subagent["enabled"]:
            return {"success": False, "error": "Subagent is disabled"}
        if not self._model_callback:
            return {"success": False, "error": "No model callback configured"}
        try:
            response = self._model_callback(query, system_prompt=subagent["system_prompt"])
            return {"success": True, "response": response, "subagent": subagent["name"]}
        except Exception as e:
            return {"success": False, "error": str(e)}


_manager: Optional[SubagentManager] = None


def get_subagent_manager(db_conn: Optional[sqlite3.Connection] = None) -> SubagentManager:
    global _manager
    if _manager is None:
        _manager = SubagentManager(db_conn)
    return _manager


def reset_subagent_manager():
    global _manager
    _manager = None
