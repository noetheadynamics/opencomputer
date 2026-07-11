"""Performance Monitoring API routes."""

from __future__ import annotations

from fastapi import APIRouter
from pydantic import BaseModel
from typing import Optional

from ..core.performance_monitor import get_performance_monitor

router = APIRouter(tags=["performance"])


class RecordCallRequest(BaseModel):
    session_id: str
    provider: str
    model: str
    task_type: str = "general"
    tokens_in: int = 0
    tokens_out: int = 0
    latency_ms: int = 0
    success: bool = True


@router.get("/session/{session_id}")
async def get_session_performance(session_id: str):
    pm = get_performance_monitor()
    return {
        "session_id": session_id,
        "summary": pm.get_session_stats(session_id),
        "by_model": pm.get_model_stats(session_id),
        "by_task": pm.get_task_type_stats(session_id),
    }


@router.get("/session/{session_id}/records")
async def get_session_records(session_id: str, limit: int = 100):
    pm = get_performance_monitor()
    return pm.get_records(session_id, limit)


@router.post("/record")
async def record_call(req: RecordCallRequest):
    pm = get_performance_monitor()
    pm.record_call(
        session_id=req.session_id,
        provider=req.provider,
        model=req.model,
        task_type=req.task_type,
        tokens_in=req.tokens_in,
        tokens_out=req.tokens_out,
        latency_ms=req.latency_ms,
        success=req.success,
    )
    return {"success": True}


@router.get("/session/{session_id}/export")
async def export_session_performance(session_id: str):
    pm = get_performance_monitor()
    return {
        "session_id": session_id,
        "summary": pm.get_session_stats(session_id),
        "by_model": pm.get_model_stats(session_id),
        "by_task": pm.get_task_type_stats(session_id),
        "records": pm.get_records(session_id, limit=1000),
    }
