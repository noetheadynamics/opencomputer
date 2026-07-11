"""Background Tasks API routes."""

from __future__ import annotations

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional, Dict, Any

from ..core.background_tasks import get_task_manager

router = APIRouter(tags=["background-tasks"])


class TaskCreateRequest(BaseModel):
    session_id: str
    task_type: str
    payload: Dict[str, Any] = {}
    priority: int = 0


@router.post("/create")
async def create_task(req: TaskCreateRequest):
    tm = get_task_manager()
    task_id = tm.create_task(
        session_id=req.session_id,
        task_type=req.task_type,
        payload=req.payload,
        priority=req.priority,
    )
    return {"task_id": task_id}


@router.post("/{task_id}/start")
async def start_task(task_id: str):
    tm = get_task_manager()
    await tm.start_task(task_id)
    return {"success": True}


@router.post("/{task_id}/pause")
async def pause_task(task_id: str):
    tm = get_task_manager()
    tm.pause_task(task_id)
    return {"success": True}


@router.post("/{task_id}/resume")
async def resume_task(task_id: str):
    tm = get_task_manager()
    tm.resume_task(task_id)
    return {"success": True}


@router.delete("/{task_id}")
async def cancel_task(task_id: str):
    tm = get_task_manager()
    tm.cancel_task(task_id)
    return {"success": True}


@router.get("/session/{session_id}")
async def get_session_tasks(session_id: str):
    tm = get_task_manager()
    tasks = tm.get_tasks_for_session(session_id)
    return {"tasks": tasks}


@router.get("/{task_id}/status")
async def get_task_status(task_id: str):
    tm = get_task_manager()
    status = tm.get_task_status(task_id)
    if not status:
        raise HTTPException(status_code=404, detail="Task not found")
    return status
