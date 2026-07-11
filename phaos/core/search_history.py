"""Search History — SQLite storage for search queries, results, and favorites."""

from __future__ import annotations

import json
import logging
import sqlite3
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

logger = logging.getLogger(__name__)


class SearchHistory:
    """Persist search history with favorites in SQLite."""

    def __init__(self, db_conn: Optional[sqlite3.Connection] = None):
        self._db = db_conn
        self._ensure_table()

    def _ensure_table(self):
        if self._db is None:
            return
        self._db.execute("""
            CREATE TABLE IF NOT EXISTS search_history (
                id TEXT PRIMARY KEY,
                query TEXT NOT NULL,
                engine TEXT NOT NULL,
                results TEXT NOT NULL,
                filters TEXT,
                result_count INTEGER NOT NULL,
                is_favorite INTEGER DEFAULT 0,
                created_at TEXT NOT NULL
            )
        """)
        self._db.commit()

    def _fetch_dicts(self, cursor) -> List[Dict[str, Any]]:
        columns = [desc[0] for desc in cursor.description] if cursor.description else []
        return [dict(zip(columns, row)) for row in cursor.fetchall()]

    def add_search(
        self,
        query: str,
        engine: str,
        results: List[Dict[str, Any]],
        filters: Optional[Dict[str, Any]] = None,
    ) -> str:
        search_id = uuid.uuid4().hex[:12]
        now = datetime.now(timezone.utc).isoformat()
        self._db.execute(
            """INSERT INTO search_history
               (id, query, engine, results, filters, result_count, is_favorite, created_at)
               VALUES (?, ?, ?, ?, ?, ?, 0, ?)""",
            (search_id, query, engine, json.dumps(results), json.dumps(filters) if filters else None, len(results), now),
        )
        self._db.commit()
        return search_id

    def get_history(
        self,
        limit: int = 50,
        offset: int = 0,
        query_filter: Optional[str] = None,
    ) -> List[Dict[str, Any]]:
        if self._db is None:
            return []
        if query_filter:
            pattern = f"%{query_filter}%"
            cursor = self._db.execute(
                "SELECT * FROM search_history WHERE query LIKE ? ORDER BY created_at DESC LIMIT ? OFFSET ?",
                (pattern, limit, offset),
            )
        else:
            cursor = self._db.execute(
                "SELECT * FROM search_history ORDER BY created_at DESC LIMIT ? OFFSET ?",
                (limit, offset),
            )
        rows = self._fetch_dicts(cursor)
        for r in rows:
            if r.get("results"):
                try:
                    r["results"] = json.loads(r["results"])
                except (json.JSONDecodeError, TypeError):
                    r["results"] = []
            if r.get("filters"):
                try:
                    r["filters"] = json.loads(r["filters"])
                except (json.JSONDecodeError, TypeError):
                    r["filters"] = None
        return rows

    def get_search(self, search_id: str) -> Optional[Dict[str, Any]]:
        if self._db is None:
            return None
        cursor = self._db.execute("SELECT * FROM search_history WHERE id=?", (search_id,))
        rows = self._fetch_dicts(cursor)
        if not rows:
            return None
        row = rows[0]
        if row.get("results"):
            try:
                row["results"] = json.loads(row["results"])
            except (json.JSONDecodeError, TypeError):
                row["results"] = []
        if row.get("filters"):
            try:
                row["filters"] = json.loads(row["filters"])
            except (json.JSONDecodeError, TypeError):
                row["filters"] = None
        return row

    def delete_search(self, search_id: str) -> bool:
        if self._db is None:
            return False
        cursor = self._db.execute("DELETE FROM search_history WHERE id=?", (search_id,))
        self._db.commit()
        return cursor.rowcount > 0

    def clear_history(self) -> bool:
        if self._db is None:
            return False
        self._db.execute("DELETE FROM search_history")
        self._db.commit()
        return True

    def set_favorite(self, search_id: str, favorite: bool) -> bool:
        if self._db is None:
            return False
        cursor = self._db.execute(
            "UPDATE search_history SET is_favorite=? WHERE id=?",
            (int(favorite), search_id),
        )
        self._db.commit()
        return cursor.rowcount > 0

    def get_favorites(self, limit: int = 50) -> List[Dict[str, Any]]:
        if self._db is None:
            return []
        cursor = self._db.execute(
            "SELECT * FROM search_history WHERE is_favorite=1 ORDER BY created_at DESC LIMIT ?",
            (limit,),
        )
        rows = self._fetch_dicts(cursor)
        for r in rows:
            if r.get("results"):
                try:
                    r["results"] = json.loads(r["results"])
                except (json.JSONDecodeError, TypeError):
                    r["results"] = []
        return rows

    def get_stats(self) -> Dict[str, Any]:
        if self._db is None:
            return {"total": 0, "favorites": 0}
        cursor = self._db.execute("SELECT COUNT(*) FROM search_history")
        total = cursor.fetchone()[0]
        cursor = self._db.execute("SELECT COUNT(*) FROM search_history WHERE is_favorite=1")
        favorites = cursor.fetchone()[0]
        return {"total": total, "favorites": favorites}
