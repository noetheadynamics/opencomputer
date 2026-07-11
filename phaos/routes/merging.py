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
    get_merge_optimizer(db.conn)
    get_model_merger(optimizer=get_merge_optimizer(db.conn))


@router.get("/strategies")
async def get_available_strategies():
    return {
        "strategies": [
            {
                "id": "simple_average",
                "name": "Simple Average",
                "description": "Returns the first (highest priority) model response",
            },
            {
                "id": "sens_merging",
                "name": "Sens-Merging",
                "description": "Optimizes merge coefficients based on parameter sensitivity analysis",
            },
            {
                "id": "activation_informed",
                "name": "Activation-Informed Merging",
                "description": "Merges based on activation patterns during inference",
            },
            {
                "id": "dynamic",
                "name": "Dynamic Merging",
                "description": "Automatically selects the best strategy per task type based on performance",
            },
        ]
    }


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
    return {"success": True, "task_type": req.task_type, "strategy": req.strategy}


@router.post("/test")
async def test_merge(req: MergeTestRequest):
    merger = get_model_merger()
    try:
        callback = merger.merge_for_task(req.task_type, req.query)
        if not callback:
            return {"success": False, "error": "No merge callback available. Enable merging and register models."}
        result = callback(req.query)
        return {"success": True, "result": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


@router.get("/performance/{task_type}")
async def get_merge_performance(task_type: str):
    optimizer = get_merge_optimizer()
    scores = optimizer.get_all_strategy_scores(task_type)
    records = optimizer.get_merge_records(task_type)
    return {"scores": scores, "records": records}


@router.get("/status")
async def get_merge_status():
    merger = get_model_merger()
    return merger.get_status()
