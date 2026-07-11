"""User Preferences — stored in SQLite, key-value with JSON values."""

from __future__ import annotations

import json
import uuid
from datetime import datetime, timezone
from typing import Optional, Any, Dict

from ..db.database import get_db


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _id() -> str:
    return uuid.uuid4().hex[:12]


class UserPreferences:
    """Persistent user preferences stored in SQLite."""

    def __init__(self):
        self._ensure_table()

    def _ensure_table(self):
        db = get_db()
        db.conn.execute("""
            CREATE TABLE IF NOT EXISTS user_preferences (
                id TEXT PRIMARY KEY,
                user_id TEXT NOT NULL,
                key TEXT NOT NULL,
                value TEXT NOT NULL,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL,
                UNIQUE(user_id, key)
            )
        """)
        db.conn.commit()

    def get(self, user_id: str, key: str) -> Optional[Any]:
        db = get_db()
        cursor = db.conn.execute(
            "SELECT value FROM user_preferences WHERE user_id=? AND key=?",
            (user_id, key),
        )
        row = cursor.fetchone()
        if row:
            try:
                return json.loads(row["value"])
            except (json.JSONDecodeError, TypeError):
                return row["value"]
        return None

    def set(self, user_id: str, key: str, value: Any):
        now = _now()
        db = get_db()
        db.conn.execute(
            """INSERT INTO user_preferences (id, user_id, key, value, created_at, updated_at)
               VALUES (?, ?, ?, ?, ?, ?)
               ON CONFLICT(user_id, key) DO UPDATE SET value=?, updated_at=?""",
            (_id(), user_id, key, json.dumps(value), now, now, json.dumps(value), now),
        )
        db.conn.commit()

    def get_all(self, user_id: str) -> Dict[str, Any]:
        db = get_db()
        cursor = db.conn.execute(
            "SELECT key, value FROM user_preferences WHERE user_id=?",
            (user_id,),
        )
        result = {}
        for row in cursor.fetchall():
            try:
                result[row["key"]] = json.loads(row["value"])
            except (json.JSONDecodeError, TypeError):
                result[row["key"]] = row["value"]
        return result

    def delete(self, user_id: str, key: str) -> bool:
        db = get_db()
        cursor = db.conn.execute(
            "DELETE FROM user_preferences WHERE user_id=? AND key=?",
            (user_id, key),
        )
        db.conn.commit()
        return cursor.rowcount > 0


# Global singleton
_preferences: Optional[UserPreferences] = None


def get_preferences() -> UserPreferences:
    global _preferences
    if _preferences is None:
        _preferences = UserPreferences()
    return _preferences
