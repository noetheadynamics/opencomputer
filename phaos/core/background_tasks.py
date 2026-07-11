"""Session-Aware Background Tasks — multiple tasks per session with lifecycle management."""

from __future__ import annotations

import asyncio
import json
import uuid
import sqlite3
from datetime import datetime, timezone
from typing import Optional, List, Dict, Any
from enum import Enum

from ..db.database import get_db


class TaskStatus(str, Enum):
    QUEUED = "queued"
    RUNNING = "running"
    PAUSED = "paused"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"


def _id() -> str:
    return uuid.uuid4().hex[:12]


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


class BackgroundTaskManager:
    """Manages background tasks per session with full lifecycle support."""

    def __init__(self):
        self._running_tasks: Dict[str, asyncio.Task] = {}
        self._ensure_table()

    def _ensure_table(self):
        db = get_db()
        db.conn.execute("""
            CREATE TABLE IF NOT EXISTS background_tasks (
                id TEXT PRIMARY KEY,
                session_id TEXT NOT NULL,
                task_type TEXT NOT NULL,
                payload TEXT DEFAULT '{}',
                status TEXT NOT NULL DEFAULT 'queued',
                priority INTEGER DEFAULT 0,
                progress INTEGER DEFAULT 0,
                result TEXT,
                error TEXT,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            )
        """)
        db.conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_bg_session ON background_tasks(session_id)"
        )
        db.conn.commit()

    def create_task(
        self,
        session_id: str,
        task_type: str,
        payload: Dict[str, Any],
        priority: int = 0,
    ) -> str:
        task_id = _id()
        now = _now()
        db = get_db()
        db.conn.execute(
            """INSERT INTO background_tasks
               (id, session_id, task_type, payload, status, priority, progress, created_at, updated_at)
               VALUES (?, ?, ?, ?, ?, ?, 0, ?, ?)""",
            (task_id, session_id, task_type, json.dumps(payload), TaskStatus.QUEUED.value, priority, now, now),
        )
        db.conn.commit()
        return task_id

    async def start_task(self, task_id: str):
        task_data = self.get_task(task_id)
        if not task_data:
            raise ValueError(f"Task {task_id} not found")
        self._update_status(task_id, TaskStatus.RUNNING)
        self._running_tasks[task_id] = asyncio.create_task(self._execute_task(task_id))

    def pause_task(self, task_id: str):
        task_data = self.get_task(task_id)
        if task_data and task_data["status"] == TaskStatus.RUNNING.value:
            self._update_status(task_id, TaskStatus.PAUSED)
            if task_id in self._running_tasks:
                self._running_tasks[task_id].cancel()

    def resume_task(self, task_id: str):
        task_data = self.get_task(task_id)
        if task_data and task_data["status"] == TaskStatus.PAUSED.value:
            self._running_tasks[task_id] = asyncio.create_task(self.start_task(task_id))

    def cancel_task(self, task_id: str):
        self._update_status(task_id, TaskStatus.CANCELLED)
        if task_id in self._running_tasks:
            self._running_tasks[task_id].cancel()

    def _update_status(self, task_id: str, status: TaskStatus, result: Any = None, error: str = None):
        now = _now()
        db = get_db()
        if result is not None:
            db.conn.execute(
                "UPDATE background_tasks SET status=?, result=?, updated_at=? WHERE id=?",
                (status.value, json.dumps(result) if result is not None else None, now, task_id),
            )
        elif error is not None:
            db.conn.execute(
                "UPDATE background_tasks SET status=?, error=?, updated_at=? WHERE id=?",
                (status.value, error, now, task_id),
            )
        else:
            db.conn.execute(
                "UPDATE background_tasks SET status=?, updated_at=? WHERE id=?",
                (status.value, now, task_id),
            )
        db.conn.commit()

    def _update_progress(self, task_id: str, progress: int):
        now = _now()
        db = get_db()
        db.conn.execute(
            "UPDATE background_tasks SET progress=?, updated_at=? WHERE id=?",
            (progress, now, task_id),
        )
        db.conn.commit()

    async def _execute_task(self, task_id: str):
        task_data = self.get_task(task_id)
        if not task_data:
            return
        try:
            payload = json.loads(task_data["payload"])
            task_type = task_data["task_type"]

            if task_type == "coding":
                result = await self._handle_coding(payload)
            elif task_type == "vision":
                result = await self._handle_vision(payload)
            elif task_type == "reasoning":
                result = await self._handle_reasoning(payload)
            else:
                result = await self._handle_general(payload)

            self._update_status(task_id, TaskStatus.COMPLETED, result=result)
            self._update_progress(task_id, 100)
        except asyncio.CancelledError:
            pass
        except Exception as e:
            self._update_status(task_id, TaskStatus.FAILED, error=str(e))
        finally:
            self._running_tasks.pop(task_id, None)

    async def _handle_coding(self, payload: Dict) -> Dict:
        return {"output": "Coding task completed", "files_changed": []}

    async def _handle_vision(self, payload: Dict) -> Dict:
        return {"output": "Vision task completed", "analysis": ""}

    async def _handle_reasoning(self, payload: Dict) -> Dict:
        return {"output": "Reasoning task completed", "chain": []}

    async def _handle_general(self, payload: Dict) -> Dict:
        return {"output": "Task completed"}

    def get_task(self, task_id: str) -> Optional[Dict]:
        db = get_db()
        cursor = db.conn.execute("SELECT * FROM background_tasks WHERE id=?", (task_id,))
        row = cursor.fetchone()
        return dict(row) if row else None

    def get_tasks_for_session(self, session_id: str) -> List[Dict]:
        db = get_db()
        cursor = db.conn.execute(
            "SELECT * FROM background_tasks WHERE session_id=? ORDER BY created_at DESC",
            (session_id,),
        )
        return [dict(r) for r in cursor.fetchall()]

    def get_task_status(self, task_id: str) -> Optional[Dict]:
        return self.get_task(task_id)


# Global singleton
_task_manager: Optional[BackgroundTaskManager] = None


def get_task_manager() -> BackgroundTaskManager:
    global _task_manager
    if _task_manager is None:
        _task_manager = BackgroundTaskManager()
    return _task_manager
