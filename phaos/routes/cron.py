"""Cron / Scheduled Tasks API — CRUD for scheduled tasks (SQLite-backed)."""

from __future__ import annotations

import json
import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from ..db.database import get_db

router = APIRouter()


class CronJobCreate(BaseModel):
    description: str
    schedule: str
    enabled: bool = True


class CronJobUpdate(BaseModel):
    description: str | None = None
    schedule: str | None = None
    enabled: bool | None = None


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _row_to_dict(row) -> dict:
    return {
        "id": row["id"],
        "description": row["name"],
        "schedule": row["schedule"],
        "enabled": bool(row["enabled"]),
        "lastRun": row["last_run"],
        "nextRun": row["next_run"],
        "createdAt": row["created_at"],
    }


@router.get("/")
async def list_jobs():
    db = get_db()
    rows = db.conn.execute(
        "SELECT * FROM cron_jobs ORDER BY created_at DESC"
    ).fetchall()
    return [_row_to_dict(r) for r in rows]


@router.post("/")
async def create_job(req: CronJobCreate):
    job_id = f"cron-{uuid.uuid4().hex[:8]}"
    db = get_db()
    db.conn.execute(
        "INSERT INTO cron_jobs (id, name, schedule, command, enabled, created_at) VALUES (?, ?, ?, ?, ?, ?)",
        (job_id, req.description, req.schedule, req.description, int(req.enabled), _now()),
    )
    db.conn.commit()
    row = db.conn.execute("SELECT * FROM cron_jobs WHERE id = ?", (job_id,)).fetchone()
    return _row_to_dict(row)


@router.patch("/{job_id}")
async def update_job(job_id: str, body: CronJobUpdate):
    db = get_db()
    row = db.conn.execute("SELECT * FROM cron_jobs WHERE id = ?", (job_id,)).fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Job not found")

    updates = []
    params: list = []
    if body.description is not None:
        updates.append("name = ?")
        params.append(body.description)
    if body.schedule is not None:
        updates.append("schedule = ?")
        params.append(body.schedule)
    if body.enabled is not None:
        updates.append("enabled = ?")
        params.append(int(body.enabled))

    if updates:
        params.append(job_id)
        db.conn.execute(f"UPDATE cron_jobs SET {', '.join(updates)} WHERE id = ?", params)
        db.conn.commit()

    row = db.conn.execute("SELECT * FROM cron_jobs WHERE id = ?", (job_id,)).fetchone()
    return _row_to_dict(row)


@router.delete("/{job_id}")
async def delete_job(job_id: str):
    db = get_db()
    cursor = db.conn.execute("DELETE FROM cron_jobs WHERE id = ?", (job_id,))
    db.conn.commit()
    if cursor.rowcount == 0:
        raise HTTPException(status_code=404, detail="Job not found")
    return {"deleted": True}
