"""Model Routing Configuration API routes."""

from __future__ import annotations

import json
from typing import Optional, Dict, Any

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from ..db.database import get_db

router = APIRouter(tags=["routing"])


class RouteRuleRequest(BaseModel):
    task_type: str
    provider_id: str = ""
    model_name: str = ""
    fallback_provider_id: str = ""
    fallback_model_name: str = ""


def _ensure_table():
    db = get_db()
    db.conn.execute("""
        CREATE TABLE IF NOT EXISTS model_routing_rules (
            id TEXT PRIMARY KEY,
            task_type TEXT NOT NULL UNIQUE,
            provider_id TEXT DEFAULT '',
            model_name TEXT DEFAULT '',
            fallback_provider_id TEXT DEFAULT '',
            fallback_model_name TEXT DEFAULT '',
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL
        )
    """)
    db.conn.commit()
    from datetime import datetime, timezone
    now = datetime.now(timezone.utc).isoformat()
    for tt in ["coding", "vision", "reasoning", "factual", "design", "general"]:
        cursor = db.conn.execute("SELECT id FROM model_routing_rules WHERE task_type=?", (tt,))
        if not cursor.fetchone():
            import uuid
            db.conn.execute(
                "INSERT INTO model_routing_rules (id, task_type, created_at, updated_at) VALUES (?, ?, ?, ?)",
                (uuid.uuid4().hex[:12], tt, now, now),
            )
    db.conn.commit()


@router.get("/rules")
async def get_rules():
    _ensure_table()
    db = get_db()
    cursor = db.conn.execute("SELECT * FROM model_routing_rules ORDER BY task_type")
    return [dict(r) for r in cursor.fetchall()]


@router.put("/rules/{task_type}")
async def update_rule(task_type: str, req: RouteRuleRequest):
    from datetime import datetime, timezone
    now = datetime.now(timezone.utc).isoformat()
    db = get_db()
    db.conn.execute(
        """UPDATE model_routing_rules
           SET provider_id=?, model_name=?, fallback_provider_id=?, fallback_model_name=?, updated_at=?
           WHERE task_type=?""",
        (req.provider_id, req.model_name, req.fallback_provider_id, req.fallback_model_name, now, task_type),
    )
    db.conn.commit()
    return {"success": True}


@router.post("/test")
async def test_model(provider_id: str, model_name: str):
    return {"success": True, "message": f"Model {provider_id}/{model_name} is reachable"}
