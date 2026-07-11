"""Memory API routes — exposes Truth Vault, Cross-Session State, Memory Store, Export, Cleanup."""

from __future__ import annotations

import io
import json
import zipfile
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, HTTPException
from fastapi.responses import Response
from pydantic import BaseModel

from ..core.memory_store import MemoryStore
from ..core.feedback_loop import FeedbackLoop
from ..db.conversation_store import (
    search_conversations,
    list_conversations as _list_conversations,
)
from ..db.database import get_db

router = APIRouter(tags=["memory"])

# ── Module-level singletons ─────────────────────────────────────────

_memory_store: Optional[MemoryStore] = None
_feedback_loop: Optional[FeedbackLoop] = None


def _get_memory_store() -> MemoryStore:
    global _memory_store
    if _memory_store is None:
        _memory_store = MemoryStore()
    return _memory_store


def _get_feedback_loop() -> FeedbackLoop:
    global _feedback_loop
    if _feedback_loop is None:
        _feedback_loop = FeedbackLoop(_get_memory_store())
    return _feedback_loop


# ── Truth Vault ─────────────────────────────────────────────────────

# In-memory truth vault for V1 (no AV2 backend wired yet)
_truth_vault: list[dict] = []


@router.get("/truth-vault")
async def get_truth_vault(limit: int = 100, fact_type: Optional[str] = None):
    results = _truth_vault
    if fact_type:
        results = [f for f in results if f.get("fact_type") == fact_type]
    return results[:limit]


@router.delete("/truth-vault/{fact_id}")
async def delete_truth_vault_fact(fact_id: str):
    global _truth_vault
    before = len(_truth_vault)
    _truth_vault[:] = [f for f in _truth_vault if f.get("id") != fact_id]
    if len(_truth_vault) == before:
        raise HTTPException(status_code=404, detail="Fact not found")
    return {"success": True}


# ── Cross-Session State ─────────────────────────────────────────────

# In-memory cross-session state for V1
_cross_session_state: dict = {
    "milestones": [],
    "open_issues": [],
    "failed_attempts": [],
    "known_blockers": [],
    "skills_learned": [],
    "last_updated": datetime.now(timezone.utc).isoformat(),
}


@router.get("/cross-session-state")
async def get_cross_session_state():
    return _cross_session_state


@router.delete("/cross-session-state/milestone/{milestone_id}")
async def delete_milestone(milestone_id: str):
    before = len(_cross_session_state.get("milestones", []))
    _cross_session_state["milestones"] = [
        m for m in _cross_session_state.get("milestones", []) if m != milestone_id
    ]
    if len(_cross_session_state["milestones"]) == before:
        raise HTTPException(status_code=404, detail="Milestone not found")
    _cross_session_state["last_updated"] = datetime.now(timezone.utc).isoformat()
    return {"success": True}


# ── Memory Store ────────────────────────────────────────────────────


class StoreInteractionRequest(BaseModel):
    query: str
    response: str
    success: bool = True
    user_correction: Optional[str] = None
    metadata: Optional[dict] = None


@router.get("/memory-store")
async def get_memory_store(
    query: Optional[str] = None,
    limit: int = 50,
    success_only: Optional[bool] = None,
):
    ms = _get_memory_store()
    if query:
        results = ms.retrieve_similar(query, top_k=limit)
    else:
        # Get all via direct SQL
        import sqlite3
        with sqlite3.connect(ms.db_path) as conn:
            conn.row_factory = sqlite3.Row
            q = "SELECT * FROM interactions"
            params: list = []
            if success_only is not None:
                q += " WHERE success = ?"
                params.append(1 if success_only else 0)
            q += " ORDER BY timestamp DESC LIMIT ?"
            params.append(limit)
            rows = conn.execute(q, params).fetchall()
            results = [dict(r) for r in rows]
    return results


@router.post("/memory-store")
async def store_interaction(req: StoreInteractionRequest):
    ms = _get_memory_store()
    interaction_id = ms.store_interaction(
        query=req.query,
        response=req.response,
        success=req.success,
        user_correction=req.user_correction,
        metadata=req.metadata,
    )
    return {"id": interaction_id}


@router.delete("/memory-store/{interaction_id}")
async def delete_interaction(interaction_id: str):
    ms = _get_memory_store()
    import sqlite3
    with sqlite3.connect(ms.db_path) as conn:
        cursor = conn.execute("DELETE FROM interactions WHERE id = ?", (interaction_id,))
        conn.commit()
        if cursor.rowcount == 0:
            raise HTTPException(status_code=404, detail="Interaction not found")
    return {"success": True}


# ── Stats ───────────────────────────────────────────────────────────


@router.get("/stats")
async def get_memory_stats():
    ms = _get_memory_store()
    ms_stats = ms.get_stats()
    conv_count = 0
    try:
        convs = _list_conversations(limit=10000)
        conv_count = len(convs)
    except Exception:
        pass
    return {
        "truth_vault_count": len(_truth_vault),
        "cross_session_milestones": len(_cross_session_state.get("milestones", [])),
        "memory_store_count": ms_stats["total"],
        "conversations_count": conv_count,
        "skills_count": 0,
        "memory_store_details": ms_stats,
    }


# ── Export ──────────────────────────────────────────────────────────


@router.post("/export")
async def export_all_memory():
    ms = _get_memory_store()
    import sqlite3
    with sqlite3.connect(ms.db_path) as conn:
        conn.row_factory = sqlite3.Row
        interactions = [dict(r) for r in conn.execute("SELECT * FROM interactions").fetchall()]

    data = {
        "truth_vault": _truth_vault,
        "cross_session_state": _cross_session_state,
        "memory_store": interactions,
        "exported_at": datetime.now(timezone.utc).isoformat(),
    }

    zip_buffer = io.BytesIO()
    with zipfile.ZipFile(zip_buffer, "w", zipfile.ZIP_DEFLATED) as zf:
        for name, content in data.items():
            zf.writestr(f"{name}.json", json.dumps(content, indent=2, default=str))

    zip_buffer.seek(0)
    return Response(
        zip_buffer.read(),
        media_type="application/zip",
        headers={"Content-Disposition": "attachment; filename=opencomputer_memory_export.zip"},
    )


# ── Cleanup ─────────────────────────────────────────────────────────


class CleanupRequest(BaseModel):
    days: int = 30


@router.post("/cleanup")
async def cleanup_memory(req: CleanupRequest):
    ms = _get_memory_store()
    import sqlite3
    from datetime import timedelta

    cutoff = (datetime.now(timezone.utc) - timedelta(days=req.days)).isoformat()
    with sqlite3.connect(ms.db_path) as conn:
        cursor = conn.execute(
            "DELETE FROM interactions WHERE timestamp < ?", (cutoff,)
        )
        deleted = cursor.rowcount
        conn.commit()
    return {"success": True, "days": req.days, "deleted_count": deleted}


# ── Corrections / Feedback ──────────────────────────────────────────


class CorrectionRequest(BaseModel):
    query: str
    original_response: str
    corrected_response: str


@router.post("/corrections")
async def store_correction(req: CorrectionRequest):
    fl = _get_feedback_loop()
    correction_id = fl.store_correction(
        query=req.query,
        original_response=req.original_response,
        corrected_response=req.corrected_response,
    )
    return {"id": correction_id}


class FeedbackRequest(BaseModel):
    type: str  # "up" or "down"


# In-memory feedback store for V1
_feedback_store: dict[str, list[dict]] = {}


@router.post("/feedback/{message_id}")
async def store_message_feedback(message_id: str, req: FeedbackRequest):
    if req.type not in ("up", "down"):
        raise HTTPException(status_code=400, detail="Type must be 'up' or 'down'")
    if message_id not in _feedback_store:
        _feedback_store[message_id] = []
    _feedback_store[message_id].append({
        "type": req.type,
        "created_at": datetime.now(timezone.utc).isoformat(),
    })
    return {"success": True}


# ── Unified Search ──────────────────────────────────────────────────


@router.get("/search")
async def search_all(q: str):
    ms = _get_memory_store()
    truth_results = [f for f in _truth_vault if q.lower() in f.get("query", "").lower()]

    memory_results = ms.retrieve_similar(q, top_k=10)

    conv_results = search_conversations(q, limit=10)

    return {
        "truth_vault": truth_results,
        "memory_store": memory_results,
        "conversations": conv_results,
    }
