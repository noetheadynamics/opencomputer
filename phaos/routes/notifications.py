"""Notifications API — CRUD for in-app notifications (SQLite-backed)."""

from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from ..db.database import get_db

router = APIRouter()


class NotificationCreate(BaseModel):
    title: str
    message: str
    type: str = "info"


@router.get("/")
async def list_notifications(limit: int = 100):
    db = get_db()
    rows = db.conn.execute(
        "SELECT * FROM notifications ORDER BY created_at DESC LIMIT ?", (limit,)
    ).fetchall()
    return [
        {
            "id": r["id"],
            "title": r["title"],
            "message": r["message"],
            "type": r["type"],
            "read": bool(r["read"]),
            "createdAt": r["created_at"],
        }
        for r in rows
    ]


@router.get("/unread-count")
async def unread_count():
    db = get_db()
    row = db.conn.execute("SELECT COUNT(*) FROM notifications WHERE read = 0").fetchone()
    return {"count": row[0]}


@router.post("/")
async def create_notification(req: NotificationCreate):
    n_id = f"notif-{uuid.uuid4().hex[:8]}"
    db = get_db()
    db.conn.execute(
        "INSERT INTO notifications (id, title, message, type, created_at) VALUES (?, ?, ?, ?, ?)",
        (n_id, req.title, req.message, req.type, datetime.now(timezone.utc).isoformat()),
    )
    db.conn.commit()
    return {"id": n_id}


@router.patch("/{notif_id}/read")
async def mark_read(notif_id: str):
    db = get_db()
    cursor = db.conn.execute("UPDATE notifications SET read = 1 WHERE id = ?", (notif_id,))
    db.conn.commit()
    if cursor.rowcount == 0:
        raise HTTPException(status_code=404, detail="Notification not found")
    return {"success": True}


@router.patch("/read-all")
async def mark_all_read():
    db = get_db()
    db.conn.execute("UPDATE notifications SET read = 1")
    db.conn.commit()
    return {"success": True}


@router.delete("/{notif_id}")
async def delete_notification(notif_id: str):
    db = get_db()
    cursor = db.conn.execute("DELETE FROM notifications WHERE id = ?", (notif_id,))
    db.conn.commit()
    if cursor.rowcount == 0:
        raise HTTPException(status_code=404, detail="Notification not found")
    return {"deleted": True}
