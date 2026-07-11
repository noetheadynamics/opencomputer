"""Memory Store using SQLite FTS5 for full-text search of interactions."""

from __future__ import annotations

import sqlite3
import json
import uuid
from datetime import datetime, timezone
from typing import Optional, List, Dict, Any


class MemoryStore:
    """Persistent memory store for all interactions."""

    def __init__(self, db_path: str = "./phaos_data.db"):
        self.db_path = db_path
        self._conn = None
        self._init_db()

    def _get_conn(self):
        """Get or create a reusable database connection."""
        if self._conn is None:
            self._conn = sqlite3.connect(self.db_path, check_same_thread=False)
            self._conn.row_factory = sqlite3.Row
        return self._conn

    def _init_db(self):
        """Initialize database tables and FTS5 index."""
        conn = self._get_conn()
        conn.execute("""
            CREATE TABLE IF NOT EXISTS interactions (
                id TEXT PRIMARY KEY,
                query TEXT NOT NULL,
                response TEXT,
                success INTEGER,
                user_correction TEXT,
                metadata TEXT,
                timestamp DATETIME
            )
        """)
        conn.execute("""
            CREATE VIRTUAL TABLE IF NOT EXISTS interactions_fts
            USING fts5(query, response, content=interactions)
        """)
        conn.execute("""
            CREATE TRIGGER IF NOT EXISTS interactions_fts_insert
            AFTER INSERT ON interactions
            BEGIN
                INSERT INTO interactions_fts(rowid, query, response)
                VALUES (new.rowid, new.query, new.response);
            END
        """)
        conn.execute("""
            CREATE TRIGGER IF NOT EXISTS interactions_fts_update
            AFTER UPDATE ON interactions
            BEGIN
                UPDATE interactions_fts
                SET query = new.query, response = new.response
                WHERE rowid = new.rowid;
            END
        """)
        conn.commit()

    def store_interaction(
        self,
        query: str,
        response: str,
        success: bool,
        user_correction: Optional[str] = None,
        metadata: Optional[Dict] = None,
    ) -> str:
        """Store an interaction and return its ID."""
        interaction_id = str(uuid.uuid4())
        conn = self._get_conn()
        conn.execute(
            """
            INSERT INTO interactions (id, query, response, success, user_correction, metadata, timestamp)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            """,
            (
                interaction_id,
                query,
                response,
                1 if success else 0,
                user_correction,
                json.dumps(metadata) if metadata else None,
                datetime.now(timezone.utc).isoformat(),
            ),
        )
        conn.commit()
        return interaction_id

    def retrieve_similar(self, query: str, top_k: int = 5) -> List[Dict]:
        """Retrieve similar interactions using FTS5 search."""
        conn = self._get_conn()
        # Escape special FTS5 characters and wrap in quotes.
        # Using simple quote-doubling for basic protection against FTS5 injection.
        # For production, consider using FTS5's simple tokenizer or external content table.
        safe_query = query.replace('"', '""')
        fts_query = f'"{safe_query}"'
        cursor = conn.execute(
            """
            SELECT i.id, i.query, i.response, i.success, i.user_correction, i.metadata, i.timestamp
            FROM interactions i
            JOIN interactions_fts fts ON i.rowid = fts.rowid
            WHERE interactions_fts MATCH ?
            ORDER BY rank
            LIMIT ?
            """,
            (fts_query, top_k),
        )
        rows = cursor.fetchall()
        return [dict(row) for row in rows]

    def get_corrections_for_query(self, query: str) -> List[str]:
        """Get user corrections for similar queries."""
        results = self.retrieve_similar(query, top_k=10)
        corrections = []
        for r in results:
            if r.get("user_correction"):
                corrections.append(r["user_correction"])
        return corrections

    def store_failure(
        self, query: str, error: str, attempted_solution: str
    ) -> str:
        """Store a failure for learning purposes."""
        return self.store_interaction(
            query=query,
            response=attempted_solution,
            success=False,
            metadata={"error": error, "type": "failure"},
        )

    def get_interaction(self, interaction_id: str) -> Optional[Dict]:
        """Get a single interaction by ID."""
        conn = self._get_conn()
        cursor = conn.execute(
            "SELECT * FROM interactions WHERE id = ?", (interaction_id,)
        )
        row = cursor.fetchone()
        return dict(row) if row else None

    def get_stats(self) -> Dict[str, Any]:
        """Get memory store statistics."""
        conn = self._get_conn()
        total = conn.execute("SELECT COUNT(*) FROM interactions").fetchone()[0]
        successful = conn.execute(
            "SELECT COUNT(*) FROM interactions WHERE success = 1"
        ).fetchone()[0]
        failed = conn.execute(
            "SELECT COUNT(*) FROM interactions WHERE success = 0"
        ).fetchone()[0]
        corrected = conn.execute(
            "SELECT COUNT(*) FROM interactions WHERE user_correction IS NOT NULL"
        ).fetchone()[0]
        return {
            "total": total,
            "successful": successful,
            "failed": failed,
            "corrected": corrected,
        }
