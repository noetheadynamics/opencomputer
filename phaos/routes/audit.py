"""Audit Log API — query and export security audit entries (SQLite-backed)."""

from __future__ import annotations

import json
import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Query
from fastapi.responses import PlainTextResponse

from ..db.database import get_db

router = APIRouter()


def log_audit(
    action: str,
    description: str,
    outcome: str = "executed",
    task_id: str | None = None,
    metadata: dict | None = None,
) -> dict:
    entry = {
        "id": f"audit-{uuid.uuid4().hex[:8]}",
        "action": action,
        "description": description,
        "outcome": outcome,
        "task_id": task_id,
        "metadata": metadata or {},
    }
    db = get_db()
    db.conn.execute(
        "INSERT INTO audit_logs (id, action, outcome, details, timestamp) VALUES (?, ?, ?, ?, ?)",
        (
            entry["id"],
            f"{action}: {description}",
            entry["outcome"],
            json.dumps({"task_id": task_id, **entry["metadata"]}),
            datetime.now(timezone.utc).isoformat(),
        ),
    )
    db.conn.commit()
    return entry


@router.get("/")
async def list_audit(
    action: str | None = Query(None),
    outcome: str | None = Query(None),
    task_id: str | None = Query(None),
    limit: int = Query(100, ge=1, le=1000),
):
    db = get_db()
    query = "SELECT * FROM audit_logs WHERE 1=1"
    params: list = []

    if action:
        query += " AND action LIKE ?"
        params.append(f"%{action}%")
    if outcome:
        query += " AND outcome = ?"
        params.append(outcome)
    if task_id:
        query += " AND details LIKE ?"
        params.append(f'%"{task_id}"%')

    query += " ORDER BY timestamp DESC LIMIT ?"
    params.append(limit)

    rows = db.conn.execute(query, params).fetchall()
    results = []
    for r in rows:
        details = {}
        try:
            details = json.loads(r["details"]) if r["details"] else {}
        except (json.JSONDecodeError, TypeError):
            pass
        results.append({
            "id": r["id"],
            "timestamp": r["timestamp"],
            "action": r["action"],
            "description": r["action"],
            "outcome": r["outcome"],
            "taskId": details.get("task_id"),
            "metadata": {k: v for k, v in details.items() if k != "task_id"},
        })
    return results


@router.get("/export")
async def export_audit_csv():
    db = get_db()
    rows = db.conn.execute(
        "SELECT * FROM audit_logs ORDER BY timestamp DESC"
    ).fetchall()
    header = "Timestamp,Action,Outcome,Details\n"
    lines = []
    for r in rows:
        desc = (r["action"] or "").replace('"', '""')
        det = (r["details"] or "").replace('"', '""')
        lines.append(f'"{r["timestamp"]}","{desc}","{r["outcome"]}","{det}"')
    return PlainTextResponse(header + "\n".join(lines), media_type="text/csv")
