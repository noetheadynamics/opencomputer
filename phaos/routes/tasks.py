"""Task routes — CRUD + real ReAct execution for agent tasks."""

import asyncio
from typing import Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from ..db import store
from ..db.schemas import TaskCreate, Task, TaskStatus, EngineStatus
from ..engine.orchestrator import LayeredOrchestrator, TaskContext

router = APIRouter()


class TaskUpdateRequest(BaseModel):
    status: Optional[TaskStatus] = None
    result: Optional[str] = None
    error: Optional[str] = None
    category: Optional[int] = None
    iterations: Optional[int] = None
    amplifications_applied: Optional[list[str]] = None
    tool_calls_made: Optional[int] = None
    total_time: Optional[float] = None

# Global orchestrator instance — initialized on first task
_orchestrator: LayeredOrchestrator | None = None


def get_orchestrator() -> LayeredOrchestrator:
    global _orchestrator
    if _orchestrator is None:
        _orchestrator = LayeredOrchestrator()
    return _orchestrator


@router.post("/", response_model=Task)
async def create_task(req: TaskCreate):
    task = store.create_task(req)
    return task


@router.post("/run", response_model=Task)
async def run_task(req: TaskCreate):
    """Create and execute a task through the full ReAct pipeline."""
    task = store.create_task(req)

    orchestrator = get_orchestrator()
    task_ctx = TaskContext(
        task_id=task.id,
        prompt=req.prompt,
        model=req.model or "local-default",
        config=req.context,
    )

    store.update_task(task.id, status=TaskStatus.REASONING)
    result = await asyncio.to_thread(orchestrator.execute, task_ctx)

    update_fields: dict = {
        "status": TaskStatus(result.status),
        "result": result.response,
        "error": result.error,
        "category": result.category,
        "iterations": result.iterations,
        "amplifications_applied": result.amplifications_applied,
        "tool_calls_made": result.tool_calls_made,
        "total_time": result.total_time,
    }
    task = store.update_task(task.id, **update_fields)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found after execution")
    return task


@router.get("/", response_model=list[Task])
async def list_tasks():
    return store.list_tasks()


@router.get("/engine", response_model=EngineStatus)
async def engine_status():
    """Get orchestrator engine status."""
    orchestrator = get_orchestrator()
    status = orchestrator.get_status()
    return EngineStatus(**status)


@router.get("/{task_id}", response_model=Task)
async def get_task(task_id: str):
    task = store.get_task(task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    return task


@router.patch("/{task_id}", response_model=Task)
async def update_task(task_id: str, body: TaskUpdateRequest):
    update_fields = {k: v for k, v in body.model_dump().items() if v is not None}
    task = store.update_task(task_id, **update_fields)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    return task
