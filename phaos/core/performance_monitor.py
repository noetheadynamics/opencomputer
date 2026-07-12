"""Performance Monitoring — per-session API call tracking and stats."""

from __future__ import annotations

import json
import uuid
import sqlite3
from datetime import datetime, timezone
from typing import Optional, List, Dict, Any

from ..db.database import get_db


def _id() -> str:
    return uuid.uuid4().hex[:12]


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


class PerformanceMonitor:
    """Tracks API call performance per session."""

    def __init__(self):
        self._ensure_table()

    def _ensure_table(self):
        db = get_db()
        db.conn.execute("""
            CREATE TABLE IF NOT EXISTS performance_records (
                id TEXT PRIMARY KEY,
                session_id TEXT NOT NULL,
                provider TEXT NOT NULL,
                model TEXT NOT NULL,
                task_type TEXT NOT NULL DEFAULT 'general',
                tokens_in INTEGER DEFAULT 0,
                tokens_out INTEGER DEFAULT 0,
                latency_ms INTEGER DEFAULT 0,
                success INTEGER DEFAULT 1,
                timestamp TEXT NOT NULL
            )
        """)
        db.conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_perf_session ON performance_records(session_id)"
        )
        db.conn.commit()

    def record_call(
        self,
        session_id: str,
        provider: str,
        model: str,
        task_type: str,
        tokens_in: int,
        tokens_out: int,
        latency_ms: int,
        success: bool,
    ):
        db = get_db()
        db.conn.execute(
            """INSERT INTO performance_records
               (id, session_id, provider, model, task_type, tokens_in, tokens_out, latency_ms, success, timestamp)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (_id(), session_id, provider, model, task_type, tokens_in, tokens_out, latency_ms, 1 if success else 0, _now()),
        )
        db.conn.commit()

    def get_session_stats(self, session_id: str) -> Dict[str, Any]:
        db = get_db()
        cursor = db.conn.execute(
            "SELECT * FROM performance_records WHERE session_id=?", (session_id,)
        )
        records = [dict(r) for r in cursor.fetchall()]
        if not records:
            return {"total_calls": 0, "total_tokens": 0, "avg_latency": 0, "success_rate": 0}

        total = len(records)
        total_tokens = sum(r["tokens_in"] + r["tokens_out"] for r in records)
        avg_latency = sum(r["latency_ms"] for r in records) / total
        success_rate = sum(1 for r in records if r["success"]) / total

        return {
            "total_calls": total,
            "total_tokens": total_tokens,
            "avg_latency": round(avg_latency, 1),
            "success_rate": round(success_rate * 100, 1),
        }

    def get_model_stats(self, session_id: str) -> Dict[str, Dict]:
        db = get_db()
        cursor = db.conn.execute(
            "SELECT * FROM performance_records WHERE session_id=?", (session_id,)
        )
        stats: Dict[str, Dict] = {}
        for r in cursor.fetchall():
            key = f"{r['provider']}/{r['model']}"
            if key not in stats:
                stats[key] = {"calls": 0, "tokens": 0}
            stats[key]["calls"] += 1
            stats[key]["tokens"] += r["tokens_in"] + r["tokens_out"]
        return stats

    def get_task_type_stats(self, session_id: str) -> Dict[str, Dict]:
        db = get_db()
        cursor = db.conn.execute(
            "SELECT * FROM performance_records WHERE session_id=?", (session_id,)
        )
        stats: Dict[str, Dict] = {}
        for r in cursor.fetchall():
            tt = r["task_type"]
            if tt not in stats:
                stats[tt] = {"calls": 0, "tokens": 0}
            stats[tt]["calls"] += 1
            stats[tt]["tokens"] += r["tokens_in"] + r["tokens_out"]
        return stats

    def get_records(self, session_id: str, limit: int = 100) -> List[Dict]:
        db = get_db()
        cursor = db.conn.execute(
            "SELECT * FROM performance_records WHERE session_id=? ORDER BY timestamp DESC LIMIT ?",
            (session_id, limit),
        )
        return [dict(r) for r in cursor.fetchall()]


# Global singleton
_monitor: Optional[PerformanceMonitor] = None
_lock = __import__('threading').Lock()


def get_performance_monitor() -> PerformanceMonitor:
    global _monitor
    if _monitor is None:
        with _lock:
            if _monitor is None:
                _monitor = PerformanceMonitor()
    return _monitor
