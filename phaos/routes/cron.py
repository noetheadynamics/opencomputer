"""Cron / Scheduled Tasks API — CRUD for scheduled tasks."""

from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Any

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

router = APIRouter()

_jobs: dict[str, dict[str, Any]] = {}


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


def _next_run(schedule: str) -> str:
    return _now()


@router.get("/")
async def list_jobs():
    return list(_jobs.values())


@router.post("/")
async def create_job(req: CronJobCreate):
    job_id = f"cron-{uuid.uuid4().hex[:8]}"
    job = {
        "id": job_id,
        "description": req.description,
        "schedule": req.schedule,
        "enabled": req.enabled,
        "lastRun": None,
        "lastStatus": None,
        "nextRun": _next_run(req.schedule),
        "createdAt": _now(),
    }
    _jobs[job_id] = job
    return job


@router.patch("/{job_id}")
async def update_job(job_id: str, body: CronJobUpdate):
    job = _jobs.get(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    if body.description is not None:
        job["description"] = body.description
    if body.schedule is not None:
        job["schedule"] = body.schedule
    if body.enabled is not None:
        job["enabled"] = body.enabled
    return job


@router.delete("/{job_id}")
async def delete_job(job_id: str):
    if job_id not in _jobs:
        raise HTTPException(status_code=404, detail="Job not found")
    del _jobs[job_id]
    return {"deleted": True}
