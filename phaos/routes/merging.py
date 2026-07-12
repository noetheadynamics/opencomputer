"""Model Merging API routes — configure and test merge strategies."""

from __future__ import annotations

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List, Optional

from ..core.integration.model_merging import get_model_merger, STRATEGIES, TASK_TO_MODELS
from ..core.integration.merge_optimizer import get_merge_optimizer
from ..db.database import get_db

router = APIRouter(tags=["merging"])


class MergeStrategyRequest(BaseModel):
    task_type: str
    strategy: str


class MergeTestRequest(BaseModel):
    task_type: str
    query: str
    strategy: Optional[str] = None


@router.on_event("startup")
async def startup():
    db = get_db()
    # Create merge_strategies table for persistence
    db.conn.execute("""
        CREATE TABLE IF NOT EXISTS merge_strategies (
            task_type TEXT PRIMARY KEY,
            strategy TEXT NOT NULL DEFAULT 'default',
            updated_at TEXT NOT NULL
        )
    """)
    db.conn.commit()
    # Initialize optimizer first, then merger with optimizer
    optimizer = get_merge_optimizer(db.conn)
    merger = get_model_merger(optimizer=optimizer)
    # Load persisted strategies into merger
    cursor = db.conn.execute("SELECT task_type, strategy FROM merge_strategies")
    for row in cursor.fetchall():
        merger.task_strategies[row["task_type"]] = row["strategy"]


@router.get("/strategies")
async def get_available_strategies():
    strategy_list = []
    for s_id, s_info in STRATEGIES.items():
        strategy_list.append({
            "id": s_id,
            "name": s_info.get("name", s_id),
            "description": s_info.get("description", ""),
        })
    return {"strategies": strategy_list}


@router.get("/task-strategies")
async def get_task_strategies():
    merger = get_model_merger()
    strategies = []
    for task_type in TASK_TO_MODELS:
        current = merger.task_strategies.get(task_type, "default")
        strategies.append({"task_type": task_type, "strategy": current})
    return strategies


@router.post("/task-strategies")
async def set_task_strategy(req: MergeStrategyRequest):
    if req.task_type not in TASK_TO_MODELS:
        raise HTTPException(status_code=400, detail=f"Invalid task type: {req.task_type}")
    if req.strategy not in STRATEGIES and req.strategy != "default":
        raise HTTPException(status_code=400, detail=f"Invalid strategy: {req.strategy}")
    merger = get_model_merger()
    merger.set_strategy_for_task(req.task_type, req.strategy)
    # Persist to SQLite
    from datetime import datetime, timezone
    from ..db.database import get_db
    db = get_db()
    now = datetime.now(timezone.utc).isoformat()
    db.conn.execute(
        "INSERT OR REPLACE INTO merge_strategies (task_type, strategy, updated_at) VALUES (?, ?, ?)",
        (req.task_type, req.strategy, now),
    )
    db.conn.commit()
    return {"success": True, "task_type": req.task_type, "strategy": req.strategy}


@router.post("/test")
async def test_merge(req: MergeTestRequest):
    merger = get_model_merger()
    status = merger.get_status()
    if not status["enabled"]:
        return {
            "success": False,
            "error": "Model merging is disabled. Enable it in config to use merging.",
            "hint": "Merging combines outputs from multiple registered models. Currently no models are registered.",
        }
    if status["total_models"] == 0:
        return {
            "success": False,
            "error": "No models registered for merging.",
            "hint": f"Register models with specializations: {list(TASK_TO_MODELS.keys())}",
        }
    try:
        import asyncio
        callback = merger.merge_for_task(req.task_type, req.query)
        if not callback:
            return {"success": False, "error": f"No merge callback available for task type '{req.task_type}'."}
        result = await asyncio.to_thread(callback, req.query)
        return {"success": True, "result": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


@router.get("/performance/{task_type}")
async def get_merge_performance(task_type: str):
    db = get_db()
    optimizer = get_merge_optimizer(db.conn)
    scores = optimizer.get_all_strategy_scores(task_type)
    records = optimizer.get_merge_records(task_type)
    return {"scores": scores, "records": records}


@router.get("/status")
async def get_merge_status():
    merger = get_model_merger()
    return merger.get_status()
