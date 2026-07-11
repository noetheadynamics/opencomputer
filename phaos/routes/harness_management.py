"""Harness management API routes."""

from __future__ import annotations

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional, Dict, Any

from ..engine.core.harness_slot import (
    get_registry,
    HarnessDefinition,
    HarnessStatus,
)

router = APIRouter()


class HarnessResponse(BaseModel):
    """Response model for harness information."""
    id: str
    name: str
    version: str
    description: str
    entry_point: str
    supports_file_tools: bool
    supports_terminal: bool
    supports_git: bool
    supports_cron: bool
    status: str
    metadata: Dict[str, Any] = {}


class HarnessListResponse(BaseModel):
    """Response model for list of harnesses."""
    harnesses: list[HarnessResponse]
    active_harness: Optional[str]
    total_count: int


class HarnessActivateRequest(BaseModel):
    """Request model for activating a harness."""
    harness_id: str


class HarnessInstallRequest(BaseModel):
    """Request model for installing a custom harness."""
    harness_id: str
    name: str
    version: str
    description: str
    entry_point: str
    supports_file_tools: bool = False
    supports_terminal: bool = False
    supports_git: bool = False
    supports_cron: bool = False
    metadata: Dict[str, Any] = {}


class HarnessStatusResponse(BaseModel):
    """Response model for harness status."""
    active_harness: Optional[str]
    total_harnesses: int
    harnesses: list[Dict[str, Any]]


@router.get("/list", response_model=HarnessListResponse)
async def list_harnesses():
    """List all installed harnesses."""
    registry = get_registry()
    harnesses = registry.list_all()
    active = registry.get_active()

    return HarnessListResponse(
        harnesses=[
            HarnessResponse(
                id=h.id,
                name=h.name,
                version=h.version,
                description=h.description,
                entry_point=h.entry_point,
                supports_file_tools=h.supports_file_tools,
                supports_terminal=h.supports_terminal,
                supports_git=h.supports_git,
                supports_cron=h.supports_cron,
                status=h.status.value,
                metadata=h.metadata,
            )
            for h in harnesses
        ],
        active_harness=active.id if active else None,
        total_count=len(harnesses),
    )


@router.get("/active", response_model=HarnessResponse)
async def get_active_harness():
    """Get the currently active harness."""
    registry = get_registry()
    active = registry.get_active()

    if not active:
        raise HTTPException(status_code=404, detail="No active harness")

    return HarnessResponse(
        id=active.id,
        name=active.name,
        version=active.version,
        description=active.description,
        entry_point=active.entry_point,
        supports_file_tools=active.supports_file_tools,
        supports_terminal=active.supports_terminal,
        supports_git=active.supports_git,
        supports_cron=active.supports_cron,
        status=active.status.value,
        metadata=active.metadata,
    )


@router.post("/activate")
async def activate_harness(request: HarnessActivateRequest):
    """Activate a harness."""
    registry = get_registry()

    try:
        success = registry.activate(request.harness_id)
        if not success:
            raise HTTPException(status_code=500, detail="Failed to activate harness")
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))

    return {"status": "ok", "active_harness": request.harness_id}


@router.post("/install", response_model=HarnessResponse)
async def install_harness(request: HarnessInstallRequest):
    """Install a custom harness."""
    registry = get_registry()

    try:
        harness = registry.install_custom_harness(
            harness_id=request.harness_id,
            name=request.name,
            version=request.version,
            description=request.description,
            entry_point=request.entry_point,
            supports_file_tools=request.supports_file_tools,
            supports_terminal=request.supports_terminal,
            supports_git=request.supports_git,
            supports_cron=request.supports_cron,
            metadata=request.metadata,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    return HarnessResponse(
        id=harness.id,
        name=harness.name,
        version=harness.version,
        description=harness.description,
        entry_point=harness.entry_point,
        supports_file_tools=harness.supports_file_tools,
        supports_terminal=harness.supports_terminal,
        supports_git=harness.supports_git,
        supports_cron=harness.supports_cron,
        status=harness.status.value,
        metadata=harness.metadata,
    )


@router.delete("/{harness_id}")
async def uninstall_harness(harness_id: str):
    """Uninstall a harness."""
    registry = get_registry()

    try:
        success = registry.unregister(harness_id)
        if not success:
            raise HTTPException(status_code=404, detail=f"Harness {harness_id} not found")
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    return {"status": "ok", "uninstalled": harness_id}


@router.get("/status", response_model=HarnessStatusResponse)
async def get_harness_status():
    """Get status of all harnesses."""
    registry = get_registry()
    status = registry.get_harness_status()

    return HarnessStatusResponse(**status)
