"""Harness Slot API — acquire/release/list slots for parallel agent work."""

from fastapi import APIRouter, HTTPException

from ..db import store
from ..db.schemas import (
    SlotAcquireRequest,
    SlotReleaseRequest,
    HarnessSlot,
    ToggleRequest,
)

router = APIRouter()


@router.get("/slots", response_model=list[HarnessSlot])
async def list_slots():
    return store.list_slots()


@router.post("/acquire", response_model=HarnessSlot)
async def acquire_slot(req: SlotAcquireRequest):
    slot = store.acquire_slot(req.slot_id, req.task_id)
    if not slot:
        raise HTTPException(
            status_code=409,
            detail="Slot not available or does not exist",
        )
    return slot


@router.post("/release", response_model=HarnessSlot)
async def release_slot(req: SlotReleaseRequest):
    slot = store.release_slot(req.slot_id)
    if not slot:
        raise HTTPException(
            status_code=409,
            detail="Slot not occupied or does not exist",
        )
    return slot


# ── Toggle endpoints for AV2 / Alethea features ──────────────────────

@router.get("/av2/status")
async def av2_status():
    """Get AV2 adapter status."""
    from ..routes.tasks import get_orchestrator

    orch = get_orchestrator()
    av2 = getattr(orch, 'av2', None)
    if av2 is None:
        return {"enabled": False, "error": "AV2 adapter not initialized"}
    return av2.get_status()


@router.get("/alethea/status")
async def alethea_status():
    """Get Alethea adapter status."""
    from ..routes.tasks import get_orchestrator

    orch = get_orchestrator()
    alethea = getattr(orch, 'alethea', None)
    if alethea is None:
        return {"enabled": False, "error": "Alethea adapter not initialized"}
    return alethea.get_status()
