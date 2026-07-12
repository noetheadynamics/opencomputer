"""Cron / Scheduled Tasks API — CRUD for scheduled tasks (SQLite-backed)."""

from __future__ import annotations

import json
import re
import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, validator

from ..db.database import get_db

router = APIRouter()

CRON_RE = re.compile(r'^(\S+\s+){4}\S+$')


class CronJobCreate(BaseModel):
    name: str
    description: str = ""
    schedule: str
    command: str = ""
    enabled: bool = True

    @validator('schedule')
    def validate_schedule(cls, v):
        if not CRON_RE.match(v):
            raise ValueError('Invalid cron schedule format (expected 5 fields)')
        return v


class CronJobUpdate(BaseModel):
    name: str | None = None
    description: str | None = None
    schedule: str | None = None
    command: str | None = None
    enabled: bool | None = None


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _row_to_dict(row) -> dict:
    return {
        "id": row["id"],
        "name": row["name"],
        "description": row["command"] or "",
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
        (job_id, req.name, req.schedule, req.command or req.description, int(req.enabled), _now()),
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
    if body.name is not None:
        updates.append("name = ?")
        params.append(body.name)
    if body.description is not None:
        updates.append("command = ?")
        params.append(body.description)
    if body.schedule is not None:
        if not CRON_RE.match(body.schedule):
            raise HTTPException(status_code=400, detail="Invalid cron schedule format")
        updates.append("schedule = ?")
        params.append(body.schedule)
    if body.command is not None:
        updates.append("command = ?")
        params.append(body.command)
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
