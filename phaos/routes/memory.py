"""Memory API routes — Truth Vault, Cross-Session State, Memory Store, Feedback (all SQLite-backed)."""

from __future__ import annotations

import io
import json
import sqlite3
import zipfile
from datetime import datetime, timezone, timedelta
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


class TruthVaultFact(BaseModel):
    query: str
    answer: str
    sources: list[str] = []
    confidence: float = 0.0
    ttl_hours: int = 24


@router.get("/truth-vault")
async def get_truth_vault(limit: int = 100):
    db = get_db()
    now = datetime.now(timezone.utc).isoformat()
    rows = db.conn.execute(
        "SELECT * FROM truth_vault WHERE expires_at IS NULL OR expires_at > ? ORDER BY created_at DESC LIMIT ?",
        (now, limit),
    ).fetchall()
    return [
        {
            "id": r["id"],
            "query": r["query"],
            "answer": r["answer"],
            "sources": json.loads(r["sources"]) if r["sources"] else [],
            "confidence": r["confidence"],
            "ttlHours": r["ttl_hours"],
            "createdAt": r["created_at"],
            "expiresAt": r["expires_at"],
        }
        for r in rows
    ]


@router.post("/truth-vault")
async def add_truth_vault_fact(req: TruthVaultFact):
    fact_id = f"vault-{__import__('uuid').uuid4().hex[:8]}"
    db = get_db()
    now = datetime.now(timezone.utc)
    expires = (now + timedelta(hours=req.ttl_hours)).isoformat() if req.ttl_hours > 0 else None
    db.conn.execute(
        "INSERT INTO truth_vault (id, query, answer, sources, confidence, ttl_hours, created_at, expires_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
        (fact_id, req.query, req.answer, json.dumps(req.sources), req.confidence, req.ttl_hours, now.isoformat(), expires),
    )
    db.conn.commit()
    return {"id": fact_id}


@router.delete("/truth-vault/{fact_id}")
async def delete_truth_vault_fact(fact_id: str):
    db = get_db()
    cursor = db.conn.execute("DELETE FROM truth_vault WHERE id = ?", (fact_id,))
    db.conn.commit()
    if cursor.rowcount == 0:
        raise HTTPException(status_code=404, detail="Fact not found")
    return {"success": True}


# ── Cross-Session State ─────────────────────────────────────────────


@router.get("/cross-session-state")
async def get_cross_session_state():
    db = get_db()
    rows = db.conn.execute(
        "SELECT * FROM cross_session_state ORDER BY created_at DESC"
    ).fetchall()
    state = {
        "milestones": [],
        "open_issues": [],
        "failed_attempts": [],
        "known_blockers": [],
        "skills_learned": [],
        "last_updated": datetime.now(timezone.utc).isoformat(),
    }
    for r in rows:
        cat = r["category"]
        if cat in state:
            try:
                content = json.loads(r["content"]) if r["content"] else r["content"]
            except (json.JSONDecodeError, TypeError):
                content = r["content"]
            state[cat].append({"id": r["id"], "content": content, "createdAt": r["created_at"]})
    return state


class CrossSessionItem(BaseModel):
    category: str
    content: str


@router.post("/cross-session-state")
async def add_cross_session_item(req: CrossSessionItem):
    if req.category not in ("milestones", "open_issues", "failed_attempts", "known_blockers", "skills_learned"):
        raise HTTPException(status_code=400, detail=f"Invalid category: {req.category}")
    item_id = f"xs-{__import__('uuid').uuid4().hex[:8]}"
    db = get_db()
    db.conn.execute(
        "INSERT INTO cross_session_state (id, category, content, created_at) VALUES (?, ?, ?, ?)",
        (item_id, req.category, req.content, datetime.now(timezone.utc).isoformat()),
    )
    db.conn.commit()
    return {"id": item_id}


@router.delete("/cross-session-state/{item_id}")
async def delete_cross_session_item(item_id: str):
    db = get_db()
    cursor = db.conn.execute("DELETE FROM cross_session_state WHERE id = ?", (item_id,))
    db.conn.commit()
    if cursor.rowcount == 0:
        raise HTTPException(status_code=404, detail="Item not found")
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
    with sqlite3.connect(ms.db_path) as conn:
        cursor = conn.execute("DELETE FROM interactions WHERE id = ?", (interaction_id,))
        conn.commit()
        if cursor.rowcount == 0:
            raise HTTPException(status_code=404, detail="Interaction not found")
    return {"success": True}


# ── Stats ───────────────────────────────────────────────────────────


@router.get("/stats")
async def get_memory_stats():
    db = get_db()
    ms = _get_memory_store()
    ms_stats = ms.get_stats()
    vault_count = db.conn.execute("SELECT COUNT(*) FROM truth_vault").fetchone()[0]
    xs_count = db.conn.execute("SELECT COUNT(*) FROM cross_session_state").fetchone()[0]
    conv_count = 0
    try:
        convs = _list_conversations(limit=10000)
        conv_count = len(convs)
    except Exception:
        pass
    return {
        "truth_vault_count": vault_count,
        "cross_session_milestones": xs_count,
        "memory_store_count": ms_stats["total"],
        "conversations_count": conv_count,
        "skills_count": 0,
        "memory_store_details": ms_stats,
    }


# ── Export ──────────────────────────────────────────────────────────


@router.post("/export")
async def export_all_memory():
    db = get_db()
    ms = _get_memory_store()
    with sqlite3.connect(ms.db_path) as conn:
        conn.row_factory = sqlite3.Row
        interactions = [dict(r) for r in conn.execute("SELECT * FROM interactions").fetchall()]

    vault = [
        dict(r) for r in db.conn.execute("SELECT * FROM truth_vault").fetchall()
    ]
    xs = [
        dict(r) for r in db.conn.execute("SELECT * FROM cross_session_state").fetchall()
    ]

    data = {
        "truth_vault": vault,
        "cross_session_state": xs,
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
    db = get_db()
    ms = _get_memory_store()

    cutoff = (datetime.now(timezone.utc) - timedelta(days=req.days)).isoformat()
    with sqlite3.connect(ms.db_path) as conn:
        cursor = conn.execute("DELETE FROM interactions WHERE timestamp < ?", (cutoff,))
        deleted_interactions = cursor.rowcount
        conn.commit()

    cursor = db.conn.execute(
        "DELETE FROM truth_vault WHERE expires_at IS NOT NULL AND expires_at < ?",
        (cutoff,),
    )
    deleted_vault = cursor.rowcount
    cursor = db.conn.execute(
        "DELETE FROM cross_session_state WHERE created_at < ?",
        (cutoff,),
    )
    deleted_xs = cursor.rowcount
    db.conn.commit()

    return {
        "success": True,
        "days": req.days,
        "deleted_count": deleted_interactions + deleted_vault + deleted_xs,
    }


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


@router.post("/feedback/{message_id}")
async def store_message_feedback(message_id: str, req: FeedbackRequest):
    if req.type not in ("up", "down"):
        raise HTTPException(status_code=400, detail="Type must be 'up' or 'down'")
    fb_id = f"fb-{__import__('uuid').uuid4().hex[:8]}"
    db = get_db()
    db.conn.execute(
        "INSERT INTO message_feedback (id, message_id, feedback, created_at) VALUES (?, ?, ?, ?)",
        (fb_id, message_id, req.type, datetime.now(timezone.utc).isoformat()),
    )
    db.conn.commit()
    return {"success": True}


# ── Unified Search ──────────────────────────────────────────────────


@router.get("/search")
async def search_all(q: str):
    db = get_db()
    ms = _get_memory_store()

    vault_rows = db.conn.execute(
        "SELECT * FROM truth_vault WHERE query LIKE ? OR answer LIKE ?",
        (f"%{q}%", f"%{q}%"),
    ).fetchall()
    truth_results = [
        {
            "id": r["id"],
            "query": r["query"],
            "answer": r["answer"],
            "sources": json.loads(r["sources"]) if r["sources"] else [],
            "confidence": r["confidence"],
        }
        for r in vault_rows
    ]

    memory_results = ms.retrieve_similar(q, top_k=10)
    conv_results = search_conversations(q, limit=10)

    return {
        "truth_vault": truth_results,
        "memory_store": memory_results,
        "conversations": conv_results,
    }
