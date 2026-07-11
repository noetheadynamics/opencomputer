"""Compact Context API routes — DCP-inspired model-driven compaction."""

from __future__ import annotations

from fastapi import APIRouter
from pydantic import BaseModel
from typing import List, Optional

from ..core.compact_context import get_compact_context, COMPACT_TOOL_DEFINITIONS
from ..db.conversation_store import get_messages, delete_message, create_message

router = APIRouter(tags=["compact"])


def _persist_messages(conversation_id: str, new_messages: list[dict]):
    """Replace all messages for a conversation with new_messages."""
    old_messages = get_messages(conversation_id)
    for msg in old_messages:
        delete_message(msg["id"])
    for msg in new_messages:
        create_message(conversation_id, msg.get("role", "user"), msg.get("content", ""))


class TokenCountRequest(BaseModel):
    conversation_id: str
    model_name: str = "default"


class CompactRequest(BaseModel):
    conversation_id: str
    start: int
    end: int
    summary: str
    model_name: str = "default"


class DiscardRequest(BaseModel):
    conversation_id: str
    message_ids: List[int]
    model_name: str = "default"


class ProtectRequest(BaseModel):
    conversation_id: str
    message_ids: List[int]
    model_name: str = "default"


class PruneRequest(BaseModel):
    conversation_id: str
    tool_call_ids: List[str]
    model_name: str = "default"


@router.post("/conversation/tokens")
async def get_token_count(req: TokenCountRequest):
    messages = get_messages(req.conversation_id)
    ctx = get_compact_context(req.model_name)
    return ctx.get_usage(messages)


@router.post("/conversation/compact")
async def compact_conversation(req: CompactRequest):
    messages = get_messages(req.conversation_id)
    ctx = get_compact_context(req.model_name)
    result = ctx.compact(messages, start=req.start, end=req.end, summary=req.summary)
    _persist_messages(req.conversation_id, result)
    return {"success": True, "original_count": len(messages), "compacted_count": len(result)}


@router.post("/conversation/discard")
async def discard_messages(req: DiscardRequest):
    messages = get_messages(req.conversation_id)
    ctx = get_compact_context(req.model_name)
    result = ctx.discard(messages, message_ids=req.message_ids)
    _persist_messages(req.conversation_id, result)
    return {"success": True, "original_count": len(messages), "new_count": len(result)}


@router.post("/conversation/protect")
async def protect_messages(req: ProtectRequest):
    messages = get_messages(req.conversation_id)
    ctx = get_compact_context(req.model_name)
    ctx.protect(messages, message_ids=req.message_ids)
    return {"success": True, "protected": req.message_ids}


@router.post("/conversation/prune")
async def prune_messages(req: PruneRequest):
    messages = get_messages(req.conversation_id)
    ctx = get_compact_context(req.model_name)
    result = ctx.prune(messages, tool_call_ids=req.tool_call_ids)
    _persist_messages(req.conversation_id, result)
    return {"success": True, "original_count": len(messages), "new_count": len(result)}


@router.get("/tools")
async def get_compact_tools():
    return COMPACT_TOOL_DEFINITIONS
