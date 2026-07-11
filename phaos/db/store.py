"""In-memory store for PHAOS entities (Phase 6 switches to SQLite/Postgres)."""

from __future__ import annotations

import uuid
from datetime import datetime, timezone

from .schemas import (
    Task,
    TaskStatus,
    TaskCreate,
    HarnessSlot,
    SlotStatus,
    Skill,
)


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _id() -> str:
    return uuid.uuid4().hex[:12]


# ── Tasks ─────────────────────────────────────────────────────────────

_tasks: dict[str, Task] = {}


def create_task(req: TaskCreate) -> Task:
    task = Task(
        id=_id(),
        prompt=req.prompt,
        model=req.model or "local-default",
        status=TaskStatus.PENDING,
        result=None,
        error=None,
        category=None,
        iterations=0,
        amplifications_applied=[],
        tool_calls_made=0,
        total_time=0.0,
        created_at=_now(),
        updated_at=_now(),
    )
    _tasks[task.id] = task
    return task


def get_task(task_id: str) -> Task | None:
    return _tasks.get(task_id)


def list_tasks() -> list[Task]:
    return list(_tasks.values())


def update_task(task_id: str, **kwargs: object) -> Task | None:
    task = _tasks.get(task_id)
    if not task:
        return None
    for k, v in kwargs.items():
        if hasattr(task, k):
            setattr(task, k, v)
    task.updated_at = _now()
    return task


# ── Harness Slots ─────────────────────────────────────────────────────

_slots: dict[str, HarnessSlot] = {}

_slots_initialized = False


def _ensure_slots():
    """Lazily initialize default harness slots."""
    global _slots_initialized
    if _slots_initialized:
        return
    for _i in range(4):
        _sid = f"slot-{_i}"
        _slots[_sid] = HarnessSlot(id=_sid, name=f"Slot {_i}", status=SlotStatus.AVAILABLE)
    _slots_initialized = True


def list_slots() -> list[HarnessSlot]:
    _ensure_slots()
    return list(_slots.values())


def acquire_slot(slot_id: str, task_id: str) -> HarnessSlot | None:
    _ensure_slots()
    slot = _slots.get(slot_id)
    if not slot or slot.status != SlotStatus.AVAILABLE:
        return None
    slot.status = SlotStatus.OCCUPIED
    slot.owner_task_id = task_id
    return slot


def release_slot(slot_id: str) -> HarnessSlot | None:
    _ensure_slots()
    slot = _slots.get(slot_id)
    if not slot or slot.status != SlotStatus.OCCUPIED:
        return None
    slot.status = SlotStatus.AVAILABLE
    slot.owner_task_id = None
    return slot


# ── Skills ────────────────────────────────────────────────────────────

_skills: dict[str, Skill] = {
    "skill-run-command": Skill(
        id="skill-run-command",
        name="Run Command",
        description="Execute a shell command in the project root.",
        command="{command}",
    ),
    "skill-read-file": Skill(
        id="skill-read-file",
        name="Read File",
        description="Read the contents of a file.",
        command="cat {path}",
    ),
    "skill-write-file": Skill(
        id="skill-write-file",
        name="Write File",
        description="Write content to a file.",
        command="echo {content} > {path}",
    ),
}


def list_skills() -> list[Skill]:
    return list(_skills.values())


def get_skill(skill_id: str) -> Skill | None:
    return _skills.get(skill_id)
