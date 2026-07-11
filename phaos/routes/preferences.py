"""User Preferences API routes."""

from __future__ import annotations

from fastapi import APIRouter
from pydantic import BaseModel
from typing import Any, Optional

from ..core.user_preferences import get_preferences

router = APIRouter(tags=["preferences"])


class PrefSetRequest(BaseModel):
    key: str
    value: Any


DEFAULT_USER = "default"


@router.get("")
async def get_all_prefs():
    return get_preferences().get_all(DEFAULT_USER)


@router.get("/{key}")
async def get_pref(key: str):
    val = get_preferences().get(DEFAULT_USER, key)
    if val is None:
        return {"key": key, "value": None}
    return {"key": key, "value": val}


@router.put("/{key}")
async def set_pref(key: str, req: PrefSetRequest):
    get_preferences().set(DEFAULT_USER, key, req.value)
    return {"success": True}


@router.delete("/{key}")
async def delete_pref(key: str):
    get_preferences().delete(DEFAULT_USER, key)
    return {"success": True}
