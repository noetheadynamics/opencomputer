"""Merge Optimizer: Auto-optimization for merge strategies based on performance."""

from __future__ import annotations

import json
import logging
import sqlite3
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

logger = logging.getLogger(__name__)

STRATEGIES = ["simple_average", "sens_merging", "activation_informed", "dynamic"]


class MergeOptimizer:
    """Track merge strategy performance and recommend the best strategy per task type.

    Uses historical success rate and latency to score strategies.
    """

    def __init__(self, db_conn: Optional[sqlite3.Connection] = None):
        self._db = db_conn
        self._ensure_table()

    def _ensure_table(self):
        if self._db is None:
            return
        self._db.execute("""
            CREATE TABLE IF NOT EXISTS merge_records (
                id TEXT PRIMARY KEY,
                task_type TEXT NOT NULL,
                strategy_name TEXT NOT NULL,
                models TEXT NOT NULL,
                success INTEGER NOT NULL,
                latency_ms REAL NOT NULL,
                tokens_used INTEGER NOT NULL,
                created_at TEXT NOT NULL
            )
        """)
        self._db.commit()

    def _fetch_dicts(self, cursor) -> List[Dict[str, Any]]:
        columns = [desc[0] for desc in cursor.description] if cursor.description else []
        return [dict(zip(columns, row)) for row in cursor.fetchall()]

    def record_strategy_usage(
        self,
        task_type: str,
        strategy_name: str,
        models: List[str],
        success: bool,
        latency_ms: float,
        tokens_used: int,
    ):
        if self._db is None:
            return
        record_id = uuid.uuid4().hex[:12]
        now = datetime.now(timezone.utc).isoformat()
        self._db.execute(
            """INSERT INTO merge_records
               (id, task_type, strategy_name, models, success, latency_ms, tokens_used, created_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?)""",
            (record_id, task_type, strategy_name, json.dumps(models), int(success), latency_ms, tokens_used, now),
        )
        self._db.commit()

    def get_merge_records(
        self,
        task_type: Optional[str] = None,
        min_samples: int = 0,
    ) -> List[Dict[str, Any]]:
        if self._db is None:
            return []
        if task_type:
            cursor = self._db.execute(
                "SELECT * FROM merge_records WHERE task_type=? ORDER BY created_at DESC",
                (task_type,),
            )
        else:
            cursor = self._db.execute(
                "SELECT * FROM merge_records ORDER BY created_at DESC"
            )
        rows = self._fetch_dicts(cursor)
        if task_type and min_samples > 0:
            strategy_counts: Dict[str, int] = {}
            for r in rows:
                s = r["strategy_name"]
                strategy_counts[s] = strategy_counts.get(s, 0) + 1
            qualifying = {s for s, c in strategy_counts.items() if c >= min_samples}
            rows = [r for r in rows if r["strategy_name"] in qualifying]
        return rows

    def get_best_strategy(
        self,
        task_type: str,
        min_samples: int = 3,
    ) -> Optional[Dict[str, Any]]:
        """Get the best-performing merge strategy for a task type.

        Scoring: 60% success rate + 25% latency penalty + 15% token efficiency.
        """
        records = self.get_merge_records(task_type, min_samples)
        if not records:
            return None

        strategy_stats: Dict[str, Dict[str, float]] = {}
        for record in records:
            name = record["strategy_name"]
            if name not in strategy_stats:
                strategy_stats[name] = {
                    "successes": 0,
                    "total": 0,
                    "latency_sum": 0.0,
                    "tokens_sum": 0,
                }
            stats = strategy_stats[name]
            stats["total"] += 1
            if record["success"]:
                stats["successes"] += 1
            stats["latency_sum"] += record["latency_ms"]
            stats["tokens_sum"] += record["tokens_used"]

        best_name = None
        best_score = -1.0
        for name, stats in strategy_stats.items():
            if stats["total"] == 0:
                continue
            success_rate = stats["successes"] / stats["total"]
            avg_latency = stats["latency_sum"] / stats["total"]
            avg_tokens = stats["tokens_sum"] / stats["total"]
            latency_score = max(0.0, 1.0 - avg_latency / 10000.0)
            token_score = max(0.0, 1.0 - avg_tokens / 100000.0)
            score = success_rate * 0.60 + latency_score * 0.25 + token_score * 0.15
            if score > best_score:
                best_score = score
                best_name = name

        if best_name is None:
            return None
        return {
            "strategy": best_name,
            "score": round(best_score, 4),
            "success_rate": round(
                strategy_stats[best_name]["successes"]
                / max(strategy_stats[best_name]["total"], 1),
                4,
            ),
            "avg_latency_ms": round(
                strategy_stats[best_name]["latency_sum"]
                / max(strategy_stats[best_name]["total"], 1),
                2,
            ),
            "total_records": int(strategy_stats[best_name]["total"]),
        }

    def get_all_strategy_scores(self, task_type: str) -> List[Dict[str, Any]]:
        """Get scores for all strategies on a task type."""
        records = self.get_merge_records(task_type)
        if not records:
            return []

        strategy_stats: Dict[str, Dict[str, float]] = {}
        for record in records:
            name = record["strategy_name"]
            if name not in strategy_stats:
                strategy_stats[name] = {
                    "successes": 0,
                    "total": 0,
                    "latency_sum": 0.0,
                    "tokens_sum": 0,
                }
            stats = strategy_stats[name]
            stats["total"] += 1
            if record["success"]:
                stats["successes"] += 1
            stats["latency_sum"] += record["latency_ms"]
            stats["tokens_sum"] += record["tokens_used"]

        results = []
        for name, stats in strategy_stats.items():
            total = max(stats["total"], 1)
            results.append({
                "strategy": name,
                "success_rate": round(stats["successes"] / total, 4),
                "avg_latency_ms": round(stats["latency_sum"] / total, 2),
                "avg_tokens": round(stats["tokens_sum"] / total, 0),
                "total_records": int(stats["total"]),
            })
        results.sort(key=lambda x: x["success_rate"], reverse=True)
        return results


_optimizer_instance: Optional[MergeOptimizer] = None


def get_merge_optimizer(db_conn: Optional[sqlite3.Connection] = None) -> MergeOptimizer:
    """Get or create MergeOptimizer singleton."""
    global _optimizer_instance
    if _optimizer_instance is None:
        _optimizer_instance = MergeOptimizer(db_conn)
    return _optimizer_instance


def reset_merge_optimizer():
    """Reset singleton (for testing)."""
    global _optimizer_instance
    _optimizer_instance = None
