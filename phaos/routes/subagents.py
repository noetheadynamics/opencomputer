"""Subagent Manager API routes."""

from __future__ import annotations

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Any, Dict, List, Optional

from ..core.subagent_manager import get_subagent_manager
from ..db.database import get_db

router = APIRouter(tags=["subagents"])


class SubagentCreate(BaseModel):
    name: str
    task_type: str = "custom"
    system_prompt: str = ""
    model: str = ""
    tools: List[str] = []
    enabled: bool = True


class SubagentUpdate(BaseModel):
    name: Optional[str] = None
    task_type: Optional[str] = None
    system_prompt: Optional[str] = None
    model: Optional[str] = None
    tools: Optional[List[str]] = None
    enabled: Optional[bool] = None


class SubagentTestRequest(BaseModel):
    query: str


@router.get("/")
async def list_subagents():
    db = get_db()
    mgr = get_subagent_manager(db.conn)
    return {"subagents": mgr.get_all_subagents()}


@router.post("/")
async def create_subagent(data: SubagentCreate):
    db = get_db()
    mgr = get_subagent_manager(db.conn)
    subagent_id = mgr.create_subagent(data.model_dump())
    return {"id": subagent_id, "success": True}


@router.get("/{subagent_id}")
async def get_subagent(subagent_id: str):
    db = get_db()
    mgr = get_subagent_manager(db.conn)
    subagent = mgr.get_subagent(subagent_id)
    if not subagent:
        raise HTTPException(status_code=404, detail="Subagent not found")
    return subagent


@router.put("/{subagent_id}")
async def update_subagent(subagent_id: str, data: SubagentUpdate):
    db = get_db()
    mgr = get_subagent_manager(db.conn)
    update_data = {k: v for k, v in data.model_dump().items() if v is not None}
    if not mgr.update_subagent(subagent_id, update_data):
        raise HTTPException(status_code=404, detail="Subagent not found")
    return {"success": True}


@router.delete("/{subagent_id}")
async def delete_subagent(subagent_id: str):
    db = get_db()
    mgr = get_subagent_manager(db.conn)
    if not mgr.delete_subagent(subagent_id):
        raise HTTPException(status_code=404, detail="Subagent not found")
    return {"success": True}


@router.post("/{subagent_id}/toggle")
async def toggle_subagent(subagent_id: str, enabled: bool = True):
    db = get_db()
    mgr = get_subagent_manager(db.conn)
    if not mgr.toggle_subagent(subagent_id, enabled):
        raise HTTPException(status_code=404, detail="Subagent not found")
    return {"success": True, "enabled": enabled}


@router.post("/{subagent_id}/test")
async def test_subagent(subagent_id: str, req: SubagentTestRequest):
    db = get_db()
    mgr = get_subagent_manager(db.conn)
    result = mgr.test_subagent(subagent_id, req.query)
    return result
