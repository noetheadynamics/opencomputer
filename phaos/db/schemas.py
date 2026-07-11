"""Schemas for PHAOS tasks, harness slots, and skills."""

from __future__ import annotations

from datetime import datetime
from enum import Enum
from typing import Any

from pydantic import BaseModel, Field


# ── Task ──────────────────────────────────────────────────────────────

class TaskStatus(str, Enum):
    PENDING = "pending"
    CLASSIFYING = "classifying"
    GATING = "gating"
    REASONING = "reasoning"
    TOOL_CALLING = "tool_calling"
    OBSERVING = "observing"
    AMPLIFYING = "amplifying"
    VALIDATING = "validating"
    COMPLETED = "completed"
    FAILED = "failed"
    ABSTAINED = "abstained"


class TaskCreate(BaseModel):
    prompt: str
    model: str | None = None
    context: dict[str, Any] = Field(default_factory=dict)


class Task(BaseModel):
    id: str
    prompt: str
    model: str
    status: TaskStatus
    result: str | None = None
    error: str | None = None
    category: int | None = None
    iterations: int = 0
    amplifications_applied: list[str] = Field(default_factory=list)
    tool_calls_made: int = 0
    total_time: float = 0.0
    created_at: datetime
    updated_at: datetime


# ── Harness Slot ──────────────────────────────────────────────────────

class SlotStatus(str, Enum):
    AVAILABLE = "available"
    OCCUPIED = "occupied"
    BLOCKED = "blocked"


class HarnessSlot(BaseModel):
    id: str
    name: str
    status: SlotStatus = SlotStatus.AVAILABLE
    owner_task_id: str | None = None
    metadata: dict[str, Any] = Field(default_factory=dict)


class SlotAcquireRequest(BaseModel):
    slot_id: str
    task_id: str


class SlotReleaseRequest(BaseModel):
    slot_id: str


# ── Skill ─────────────────────────────────────────────────────────────

class Skill(BaseModel):
    id: str
    name: str
    description: str
    command: str
    enabled: bool = True


class SkillExecuteRequest(BaseModel):
    skill_id: str
    args: dict[str, Any] = Field(default_factory=dict)


class SkillExecuteResponse(BaseModel):
    skill_id: str
    output: str
    exit_code: int


# ── Engine Status ─────────────────────────────────────────────────────

class EngineStatus(BaseModel):
    active_tasks: int = 0
    alethea: dict[str, Any] = Field(default_factory=dict)
    av2: dict[str, Any] = Field(default_factory=dict)
    error_recovery: dict[str, Any] = Field(default_factory=dict)


class ToggleRequest(BaseModel):
    enabled: bool


# ── Audit Log ─────────────────────────────────────────────────────────

class AuditLog(BaseModel):
    id: str
    action: str
    outcome: str
    details: str | None = None
    timestamp: datetime


# ── Cron Job ──────────────────────────────────────────────────────────

class CronJob(BaseModel):
    id: str
    name: str
    schedule: str
    command: str
    enabled: bool = True
    last_run: datetime | None = None
    next_run: datetime | None = None
    created_at: datetime
