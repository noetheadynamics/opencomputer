"""Audit Log API — query and export security audit entries."""

from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Any

from fastapi import APIRouter, Query
from fastapi.responses import PlainTextResponse

router = APIRouter()

_entries: list[dict[str, Any]] = []
_seeded = False


def log_audit(
    action: str,
    description: str,
    outcome: str = "executed",
    task_id: str | None = None,
    metadata: dict[str, Any] | None = None,
) -> dict[str, Any]:
    entry = {
        "id": f"audit-{uuid.uuid4().hex[:8]}",
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "action": action,
        "description": description,
        "outcome": outcome,
        "taskId": task_id,
        "metadata": metadata or {},
    }
    _entries.insert(0, entry)
    if len(_entries) > 1000:
        _entries.pop()
    return entry


def _seed_if_needed():
    """Seed sample entries on first access."""
    global _seeded
    if _seeded:
        return
    _seeded = True
    log_audit("file_read", "Read file src/App.tsx", "executed")
    log_audit("terminal_command", "Run command: ls -la", "executed", task_id="task-1")
    log_audit("git_push", "Push to origin/main", "approved", task_id="task-2")


@router.on_event("startup")
async def startup():
    _seed_if_needed()


@router.get("/")
async def list_audit(
    action: str | None = Query(None),
    outcome: str | None = Query(None),
    date_from: str | None = Query(None),
    date_to: str | None = Query(None),
    task_id: str | None = Query(None),
):
    result = list(_entries)
    if action:
        result = [e for e in result if e["action"] == action]
    if outcome:
        result = [e for e in result if e["outcome"] == outcome]
    if task_id:
        result = [e for e in result if e["taskId"] == task_id]
    return result


@router.get("/export")
async def export_audit_csv():
    header = "Timestamp,Action,Description,Outcome,Task ID\n"
    rows = []
    for e in _entries:
        desc = e["description"].replace('"', '""')
        rows.append(f'"{e["timestamp"]}","{e["action"]}","{desc}","{e["outcome"]}","{e["taskId"] or ""}"')
    csv = header + "\n".join(rows)
    return PlainTextResponse(csv, media_type="text/csv")
