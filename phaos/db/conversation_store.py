"""SQLite-backed store for conversations and messages."""

from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Optional, List, Dict, Any

from .database import get_db


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _id() -> str:
    return uuid.uuid4().hex[:12]


# ── Conversations ─────────────────────────────────────────────────────

def create_conversation(
    title: str,
    provider_label: Optional[str] = None,
    model_name: Optional[str] = None,
    harness_id: str = "phaos",
    system_prompt: Optional[str] = None,
) -> Dict[str, Any]:
    """Create a new conversation."""
    db = get_db()
    conv_id = _id()
    now = _now()

    db.conn.execute(
        """INSERT INTO conversations (id, title, provider_label, model_name, harness_id, created_at, updated_at, system_prompt)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)""",
        (conv_id, title, provider_label, model_name, harness_id, now, now, system_prompt),
    )
    db.conn.commit()

    return {
        "id": conv_id,
        "title": title,
        "provider_label": provider_label,
        "model_name": model_name,
        "harness_id": harness_id,
        "created_at": now,
        "updated_at": now,
        "system_prompt": system_prompt,
    }


def get_conversation(conv_id: str) -> Optional[Dict[str, Any]]:
    """Get a conversation by ID."""
    db = get_db()
    cursor = db.conn.execute("SELECT * FROM conversations WHERE id = ?", (conv_id,))
    row = cursor.fetchone()
    if not row:
        return None
    return dict(row)


def list_conversations(limit: int = 50, include_archived: bool = False) -> List[Dict[str, Any]]:
    """List conversations ordered by updated_at."""
    db = get_db()
    query = "SELECT * FROM conversations"
    if not include_archived:
        query += " WHERE is_archived = 0"
    query += " ORDER BY updated_at DESC LIMIT ?"

    cursor = db.conn.execute(query, (limit,))
    rows = cursor.fetchall()
    return [dict(row) for row in rows]


def update_conversation(conv_id: str, **kwargs) -> Optional[Dict[str, Any]]:
    """Update a conversation."""
    db = get_db()
    updates = []
    values = []
    for key, value in kwargs.items():
        if key in ("title", "provider_label", "model_name", "harness_id", "system_prompt", "is_archived"):
            updates.append(f"{key} = ?")
            values.append(value)

    if not updates:
        return get_conversation(conv_id)

    updates.append("updated_at = ?")
    values.append(_now())
    values.append(conv_id)

    db.conn.execute(f"UPDATE conversations SET {', '.join(updates)} WHERE id = ?", values)
    db.conn.commit()
    return get_conversation(conv_id)


def delete_conversation(conv_id: str) -> bool:
    """Delete a conversation and its messages."""
    db = get_db()
    db.conn.execute("DELETE FROM messages WHERE conversation_id = ?", (conv_id,))
    db.conn.execute("DELETE FROM conversations WHERE id = ?", (conv_id,))
    db.conn.commit()
    return True


def _escape_like(s: str) -> str:
    """Escape % and _ characters for use in SQLite LIKE queries."""
    return s.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")


def search_conversations(query: str, limit: int = 10) -> List[Dict[str, Any]]:
    """Search conversations by title."""
    db = get_db()
    cursor = db.conn.execute(
        """SELECT * FROM conversations WHERE title LIKE ? AND is_archived = 0
           ORDER BY updated_at DESC LIMIT ?""",
        (f"%{_escape_like(query)}%", limit),
    )
    rows = cursor.fetchall()
    return [dict(row) for row in rows]


# ── Messages ──────────────────────────────────────────────────────────

def create_message(
    conversation_id: str,
    role: str,
    content: str,
) -> Dict[str, Any]:
    """Add a message to a conversation."""
    db = get_db()
    msg_id = _id()
    now = _now()

    db.conn.execute(
        """INSERT INTO messages (id, conversation_id, role, content, created_at)
           VALUES (?, ?, ?, ?, ?)""",
        (msg_id, conversation_id, role, content, now),
    )
    # Update conversation's updated_at
    db.conn.execute(
        "UPDATE conversations SET updated_at = ? WHERE id = ?",
        (now, conversation_id),
    )
    db.conn.commit()

    return {
        "id": msg_id,
        "conversation_id": conversation_id,
        "role": role,
        "content": content,
        "created_at": now,
    }


def get_messages(conversation_id: str, limit: int = 100) -> List[Dict[str, Any]]:
    """Get messages for a conversation."""
    db = get_db()
    cursor = db.conn.execute(
        "SELECT * FROM messages WHERE conversation_id = ? ORDER BY created_at ASC LIMIT ?",
        (conversation_id, limit),
    )
    rows = cursor.fetchall()
    return [dict(row) for row in rows]


def get_message(message_id: str) -> Optional[Dict[str, Any]]:
    """Get a single message by ID."""
    db = get_db()
    cursor = db.conn.execute("SELECT * FROM messages WHERE id = ?", (message_id,))
    row = cursor.fetchone()
    return dict(row) if row else None


def update_message(message_id: str, content: str) -> Optional[Dict[str, Any]]:
    """Update a message's content."""
    db = get_db()
    db.conn.execute("UPDATE messages SET content = ? WHERE id = ?", (content, message_id))
    db.conn.commit()
    return get_message(message_id)


def delete_message(message_id: str) -> bool:
    """Delete a message."""
    db = get_db()
    db.conn.execute("DELETE FROM messages WHERE id = ?", (message_id,))
    db.conn.commit()
    return True


def get_last_message(conversation_id: str) -> Optional[Dict[str, Any]]:
    """Get the last message in a conversation."""
    db = get_db()
    cursor = db.conn.execute(
        "SELECT * FROM messages WHERE conversation_id = ? ORDER BY rowid DESC LIMIT 1",
        (conversation_id,),
    )
    row = cursor.fetchone()
    return dict(row) if row else None


def search_messages(query: str, limit: int = 20) -> List[Dict[str, Any]]:
    """Search messages by content."""
    db = get_db()
    cursor = db.conn.execute(
        """SELECT * FROM messages WHERE content LIKE ?
           ORDER BY created_at DESC LIMIT ?""",
        (f"%{_escape_like(query)}%", limit),
    )
    rows = cursor.fetchall()
    return [dict(row) for row in rows]
