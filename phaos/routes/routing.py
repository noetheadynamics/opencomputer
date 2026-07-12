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
    """Test if a provider/model is reachable by sending a minimal request."""
    from ..db.database import get_db
    db = get_db()
    cursor = db.conn.execute("SELECT * FROM model_routing_rules WHERE provider_id=?", (provider_id,))
    row = cursor.fetchone()
    if not row:
        return {"success": False, "error": f"Provider '{provider_id}' not configured in routing rules"}
    
    # Try to reach the provider via the stored config
    import httpx
    try:
        # We need the base URL and API key from the provider config
        # Since we only store provider_id in routing, we check if the provider exists
        from ..db.database import get_db
        providers_cursor = db.conn.execute("SELECT * FROM preferences WHERE key='providers'")
        pref_row = providers_cursor.fetchone()
        if pref_row:
            import json
            providers = json.loads(pref_row["value"]) if pref_row["value"] else []
            provider = next((p for p in providers if p.get("id") == provider_id), None)
            if provider:
                base_url = provider.get("baseUrl", "").rstrip("/")
                api_key = provider.get("apiKey", "")
                async with httpx.AsyncClient(timeout=10.0) as client:
                    resp = await client.get(
                        f"{base_url}/models",
                        headers={"Authorization": f"Bearer {api_key}"},
                    )
                    if resp.status_code == 200:
                        return {"success": True, "message": f"Model {provider_id}/{model_name} is reachable"}
                    return {"success": False, "error": f"Provider returned HTTP {resp.status_code}"}
        return {"success": False, "error": f"Provider '{provider_id}' not found in settings"}
    except httpx.ConnectError:
        return {"success": False, "error": f"Cannot connect to provider '{provider_id}'"}
    except Exception as e:
        return {"success": False, "error": str(e)}
