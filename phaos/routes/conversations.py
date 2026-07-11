"""Conversation management API routes."""

from __future__ import annotations

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional, List

from ..db.conversation_store import (
    create_conversation,
    get_conversation,
    list_conversations,
    update_conversation,
    delete_conversation,
    search_conversations,
    create_message,
    get_messages,
    update_message,
    delete_message,
    get_last_message,
)

router = APIRouter()

DEFAULT_SYSTEM_PROMPT = """You are OpenComputer, an open-source AI agentic harness for the desktop.

You are powered by:
- PHAOS (Progressive Harness for Agentic Orchestration Systems) — the default orchestration harness
- AV2 — reasoning amplification (Self-Consistency, Deep Testing, Adaptive Skills)
- Alethea V2 — factual grounding (citations, abstention, zero hallucinations)

You can:
- Execute tasks on the user's machine (read/write files, run terminal commands, use git)
- Self-teach by capturing successful patterns and reusing them
- Verify facts before you act — you never guess or hallucinate
- Learn from user corrections and apply them to similar future tasks

You are provider-agnostic and harness-agnostic — you work with any AI model and any orchestration system.

When answering:
- Always cite sources for factual claims
- Abstain if you cannot verify a fact
- Show your reasoning when solving complex problems
- Use the available tools when you need to act on the machine

Your name is OpenComputer. You are built by Noethea Dynamics and released under the MIT license."""


# ── Request/Response Models ───────────────────────────────────────────

class ConversationCreate(BaseModel):
    title: str = "New Chat"
    provider_label: Optional[str] = None
    model_name: Optional[str] = None
    harness_id: str = "phaos"
    system_prompt: Optional[str] = None


class ConversationUpdate(BaseModel):
    title: Optional[str] = None
    provider_label: Optional[str] = None
    model_name: Optional[str] = None
    harness_id: Optional[str] = None
    system_prompt: Optional[str] = None
    is_archived: Optional[int] = None


class MessageCreate(BaseModel):
    role: str
    content: str


class MessageUpdate(BaseModel):
    content: str


# ── Conversation Endpoints ────────────────────────────────────────────

@router.post("")
async def create_new_conversation(request: ConversationCreate):
    """Create a new conversation."""
    system_prompt = request.system_prompt or DEFAULT_SYSTEM_PROMPT
    conv = create_conversation(
        title=request.title,
        provider_label=request.provider_label,
        model_name=request.model_name,
        harness_id=request.harness_id,
        system_prompt=system_prompt,
    )
    return conv


@router.get("")
async def list_all_conversations():
    """List all conversations."""
    conversations = list_conversations()
    return {"conversations": conversations}


@router.get("/search")
async def search_conversations_endpoint(q: str):
    """Search conversations by title."""
    results = search_conversations(q)
    return {"conversations": results}


@router.get("/{conv_id}")
async def get_conversation_detail(conv_id: str):
    """Get a conversation with its messages."""
    conv = get_conversation(conv_id)
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found")

    messages = get_messages(conv_id)
    conv["messages"] = messages
    return conv


@router.put("/{conv_id}")
async def update_conversation_detail(conv_id: str, request: ConversationUpdate):
    """Update a conversation."""
    updates = {}
    if request.title is not None:
        updates["title"] = request.title
    if request.provider_label is not None:
        updates["provider_label"] = request.provider_label
    if request.model_name is not None:
        updates["model_name"] = request.model_name
    if request.harness_id is not None:
        updates["harness_id"] = request.harness_id
    if request.system_prompt is not None:
        updates["system_prompt"] = request.system_prompt
    if request.is_archived is not None:
        updates["is_archived"] = request.is_archived

    if not updates:
        raise HTTPException(status_code=400, detail="No updates provided")

    conv = update_conversation(conv_id, **updates)
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found")
    return conv


@router.delete("/{conv_id}")
async def delete_conversation_detail(conv_id: str):
    """Delete a conversation and all its messages."""
    conv = get_conversation(conv_id)
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found")

    delete_conversation(conv_id)
    return {"success": True}


# ── Message Endpoints ─────────────────────────────────────────────────

@router.post("/{conv_id}/messages")
async def add_message_to_conversation(conv_id: str, request: MessageCreate):
    """Add a message to a conversation."""
    conv = get_conversation(conv_id)
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found")

    msg = create_message(
        conversation_id=conv_id,
        role=request.role,
        content=request.content,
    )
    return msg


@router.put("/{conv_id}/messages/{msg_id}")
async def update_message_in_conversation(conv_id: str, msg_id: str, request: MessageUpdate):
    """Update a message's content."""
    msg = update_message(msg_id, request.content)
    if not msg:
        raise HTTPException(status_code=404, detail="Message not found")
    return msg


@router.delete("/{conv_id}/messages/{msg_id}")
async def delete_message_from_conversation(conv_id: str, msg_id: str):
    """Delete a message."""
    delete_message(msg_id)
    return {"success": True}
