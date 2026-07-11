"""SQLite-backed store for PHAOS entities."""

from __future__ import annotations

import json
from datetime import datetime, timezone
from typing import Optional

from .database import get_db, _now, _id
from .schemas import (
    Task,
    TaskStatus,
    TaskCreate,
    HarnessSlot,
    SlotStatus,
    Skill,
    AuditLog,
    CronJob,
)


def _now_str() -> str:
    return _now().isoformat()


# ── Tasks ─────────────────────────────────────────────────────────────

def create_task(req: TaskCreate) -> Task:
    db = get_db()
    task_id = _id()
    now = _now_str()
    
    cursor = db.conn.cursor()
    cursor.execute(
        """INSERT INTO tasks (id, prompt, model, status, result, error, category,
           iterations, amplifications_applied, tool_calls_made, total_time,
           created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
        (
            task_id,
            req.prompt,
            req.model or "local-default",
            TaskStatus.PENDING.value,
            None,
            None,
            None,
            0,
            json.dumps([]),
            0,
            0.0,
            now,
            now,
        ),
    )
    db.conn.commit()
    
    return Task(
        id=task_id,
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


def get_task(task_id: str) -> Optional[Task]:
    db = get_db()
    cursor = db.conn.cursor()
    cursor.execute("SELECT * FROM tasks WHERE id = ?", (task_id,))
    row = cursor.fetchone()
    
    if not row:
        return None
    
    return Task(
        id=row["id"],
        prompt=row["prompt"],
        model=row["model"],
        status=TaskStatus(row["status"]),
        result=row["result"],
        error=row["error"],
        category=row["category"],
        iterations=row["iterations"],
        amplifications_applied=json.loads(row["amplifications_applied"]),
        tool_calls_made=row["tool_calls_made"],
        total_time=row["total_time"],
        created_at=datetime.fromisoformat(row["created_at"]),
        updated_at=datetime.fromisoformat(row["updated_at"]),
    )


def list_tasks() -> list[Task]:
    db = get_db()
    cursor = db.conn.cursor()
    cursor.execute("SELECT * FROM tasks ORDER BY created_at DESC")
    rows = cursor.fetchall()
    
    return [
        Task(
            id=row["id"],
            prompt=row["prompt"],
            model=row["model"],
            status=TaskStatus(row["status"]),
            result=row["result"],
            error=row["error"],
            category=row["category"],
            iterations=row["iterations"],
            amplifications_applied=json.loads(row["amplifications_applied"]),
            tool_calls_made=row["tool_calls_made"],
            total_time=row["total_time"],
            created_at=datetime.fromisoformat(row["created_at"]),
            updated_at=datetime.fromisoformat(row["updated_at"]),
        )
        for row in rows
    ]


def update_task(task_id: str, **kwargs) -> Optional[Task]:
    db = get_db()
    cursor = db.conn.cursor()
    
    # Build update query
    ALLOWED_COLUMNS = {
        "status", "result", "error", "category", "iterations",
        "amplifications_applied", "tool_calls_made", "total_time",
    }
    updates = []
    values = []
    for key, value in kwargs.items():
        if key not in ALLOWED_COLUMNS:
            continue
        if key == "status" and isinstance(value, TaskStatus):
            value = value.value
        elif key == "amplifications_applied":
            value = json.dumps(value)
        updates.append(f"{key} = ?")
        values.append(value)
    
    if not updates:
        return get_task(task_id)
    
    updates.append("updated_at = ?")
    values.append(_now_str())
    values.append(task_id)
    
    cursor.execute(
        f"UPDATE tasks SET {', '.join(updates)} WHERE id = ?",
        values,
    )
    db.conn.commit()
    
    return get_task(task_id)


# ── Harness Slots ─────────────────────────────────────────────────────

def list_slots() -> list[HarnessSlot]:
    db = get_db()
    cursor = db.conn.cursor()
    cursor.execute("SELECT * FROM harness_slots")
    rows = cursor.fetchall()
    
    return [
        HarnessSlot(
            id=row["id"],
            name=row["name"],
            status=SlotStatus(row["status"]),
            owner_task_id=row["owner_task_id"],
            metadata=json.loads(row["metadata"]),
        )
        for row in rows
    ]


def acquire_slot(slot_id: str, task_id: str) -> Optional[HarnessSlot]:
    db = get_db()
    cursor = db.conn.cursor()
    
    # Check if slot is available
    cursor.execute("SELECT * FROM harness_slots WHERE id = ?", (slot_id,))
    row = cursor.fetchone()
    
    if not row or row["status"] != SlotStatus.AVAILABLE.value:
        return None
    
    cursor.execute(
        "UPDATE harness_slots SET status = ?, owner_task_id = ? WHERE id = ?",
        (SlotStatus.OCCUPIED.value, task_id, slot_id),
    )
    db.conn.commit()
    
    return HarnessSlot(
        id=slot_id,
        name=row["name"],
        status=SlotStatus.OCCUPIED,
        owner_task_id=task_id,
        metadata=json.loads(row["metadata"]),
    )


def release_slot(slot_id: str) -> Optional[HarnessSlot]:
    db = get_db()
    cursor = db.conn.cursor()
    
    cursor.execute("SELECT * FROM harness_slots WHERE id = ?", (slot_id,))
    row = cursor.fetchone()
    
    if not row or row["status"] != SlotStatus.OCCUPIED.value:
        return None
    
    cursor.execute(
        "UPDATE harness_slots SET status = ?, owner_task_id = NULL WHERE id = ?",
        (SlotStatus.AVAILABLE.value, slot_id),
    )
    db.conn.commit()
    
    return HarnessSlot(
        id=slot_id,
        name=row["name"],
        status=SlotStatus.AVAILABLE,
        owner_task_id=None,
        metadata=json.loads(row["metadata"]),
    )


def init_slots():
    """Initialize default harness slots."""
    db = get_db()
    cursor = db.conn.cursor()
    
    # Check if slots already exist
    cursor.execute("SELECT COUNT(*) as count FROM harness_slots")
    if cursor.fetchone()["count"] > 0:
        return
    
    # Create 4 default slots
    for i in range(4):
        slot_id = f"slot-{i}"
        cursor.execute(
            "INSERT INTO harness_slots (id, name, status, metadata) VALUES (?, ?, ?, ?)",
            (slot_id, f"Slot {i}", SlotStatus.AVAILABLE.value, json.dumps({})),
        )
    db.conn.commit()


# ── Skills ────────────────────────────────────────────────────────────

def list_skills() -> list[Skill]:
    db = get_db()
    cursor = db.conn.cursor()
    cursor.execute("SELECT * FROM skills")
    rows = cursor.fetchall()
    
    return [
        Skill(
            id=row["id"],
            name=row["name"],
            description=row["description"],
            command=row["command"],
            enabled=bool(row["enabled"]),
        )
        for row in rows
    ]


def get_skill(skill_id: str) -> Optional[Skill]:
    db = get_db()
    cursor = db.conn.cursor()
    cursor.execute("SELECT * FROM skills WHERE id = ?", (skill_id,))
    row = cursor.fetchone()
    
    if not row:
        return None
    
    return Skill(
        id=row["id"],
        name=row["name"],
        description=row["description"],
        command=row["command"],
        enabled=bool(row["enabled"]),
    )


def init_skills():
    """Initialize default skills."""
    db = get_db()
    cursor = db.conn.cursor()
    
    # Check if skills already exist
    cursor.execute("SELECT COUNT(*) as count FROM skills")
    if cursor.fetchone()["count"] > 0:
        return
    
    # Create default skills
    default_skills = [
        ("skill-run-command", "Run Command", "Execute a shell command in the project root.", "{command}"),
        ("skill-read-file", "Read File", "Read the contents of a file.", "cat {path}"),
        ("skill-write-file", "Write File", "Write content to a file.", "echo {content} > {path}"),
    ]
    
    for skill_id, name, description, command in default_skills:
        cursor.execute(
            "INSERT INTO skills (id, name, description, command, enabled) VALUES (?, ?, ?, ?, ?)",
            (skill_id, name, description, command, 1),
        )
    db.conn.commit()


# ── Audit Logs ────────────────────────────────────────────────────────

def create_audit_log(action: str, outcome: str, details: Optional[str] = None) -> AuditLog:
    db = get_db()
    log_id = _id()
    now = _now_str()
    
    cursor = db.conn.cursor()
    cursor.execute(
        "INSERT INTO audit_logs (id, action, outcome, details, timestamp) VALUES (?, ?, ?, ?, ?)",
        (log_id, action, outcome, details, now),
    )
    db.conn.commit()
    
    return AuditLog(
        id=log_id,
        action=action,
        outcome=outcome,
        details=details,
        timestamp=datetime.fromisoformat(now),
    )


def list_audit_logs(
    action: Optional[str] = None,
    outcome: Optional[str] = None,
    limit: int = 100,
) -> list[AuditLog]:
    db = get_db()
    cursor = db.conn.cursor()
    
    query = "SELECT * FROM audit_logs WHERE 1=1"
    params = []
    
    if action:
        query += " AND action = ?"
        params.append(action)
    
    if outcome:
        query += " AND outcome = ?"
        params.append(outcome)
    
    query += " ORDER BY timestamp DESC LIMIT ?"
    params.append(limit)
    
    cursor.execute(query, params)
    rows = cursor.fetchall()
    
    return [
        AuditLog(
            id=row["id"],
            action=row["action"],
            outcome=row["outcome"],
            details=row["details"],
            timestamp=datetime.fromisoformat(row["timestamp"]),
        )
        for row in rows
    ]


# ── Cron Jobs ─────────────────────────────────────────────────────────

def create_cron_job(name: str, schedule: str, command: str) -> CronJob:
    db = get_db()
    job_id = _id()
    now = _now_str()
    
    cursor = db.conn.cursor()
    cursor.execute(
        """INSERT INTO cron_jobs (id, name, schedule, command, enabled, created_at)
           VALUES (?, ?, ?, ?, ?, ?)""",
        (job_id, name, schedule, command, 1, now),
    )
    db.conn.commit()
    
    return CronJob(
        id=job_id,
        name=name,
        schedule=schedule,
        command=command,
        enabled=True,
        last_run=None,
        next_run=None,
        created_at=datetime.fromisoformat(now),
    )


def list_cron_jobs() -> list[CronJob]:
    db = get_db()
    cursor = db.conn.cursor()
    cursor.execute("SELECT * FROM cron_jobs ORDER BY created_at DESC")
    rows = cursor.fetchall()
    
    return [
        CronJob(
            id=row["id"],
            name=row["name"],
            schedule=row["schedule"],
            command=row["command"],
            enabled=bool(row["enabled"]),
            last_run=datetime.fromisoformat(row["last_run"]) if row["last_run"] else None,
            next_run=datetime.fromisoformat(row["next_run"]) if row["next_run"] else None,
            created_at=datetime.fromisoformat(row["created_at"]),
        )
        for row in rows
    ]


def delete_cron_job(job_id: str) -> bool:
    db = get_db()
    cursor = db.conn.cursor()
    cursor.execute("DELETE FROM cron_jobs WHERE id = ?", (job_id,))
    db.conn.commit()
    return cursor.rowcount > 0


# ── Harness Configs ───────────────────────────────────────────────────

def list_harness_configs() -> list[dict]:
    db = get_db()
    cursor = db.conn.cursor()
    cursor.execute("SELECT * FROM harness_configs")
    rows = cursor.fetchall()
    
    return [
        {
            "id": row["id"],
            "name": row["name"],
            "version": row["version"],
            "description": row["description"],
            "entry_point": row["entry_point"],
            "supports_file_tools": bool(row["supports_file_tools"]),
            "supports_terminal": bool(row["supports_terminal"]),
            "supports_git": bool(row["supports_git"]),
            "supports_cron": bool(row["supports_cron"]),
            "is_active": bool(row["is_active"]),
        }
        for row in rows
    ]


def get_active_harness() -> Optional[dict]:
    db = get_db()
    cursor = db.conn.cursor()
    cursor.execute("SELECT * FROM harness_configs WHERE is_active = 1")
    row = cursor.fetchone()
    
    if not row:
        return None
    
    return {
        "id": row["id"],
        "name": row["name"],
        "version": row["version"],
        "description": row["description"],
        "entry_point": row["entry_point"],
        "supports_file_tools": bool(row["supports_file_tools"]),
        "supports_terminal": bool(row["supports_terminal"]),
        "supports_git": bool(row["supports_git"]),
        "supports_cron": bool(row["supports_cron"]),
        "is_active": bool(row["is_active"]),
    }


def activate_harness(harness_id: str) -> bool:
    db = get_db()
    cursor = db.conn.cursor()
    
    # Deactivate all harnesses
    cursor.execute("UPDATE harness_configs SET is_active = 0")
    
    # Activate the specified harness
    cursor.execute(
        "UPDATE harness_configs SET is_active = 1 WHERE id = ?",
        (harness_id,),
    )
    db.conn.commit()
    
    return cursor.rowcount > 0


def init_harness_configs():
    """Initialize default harness configurations."""
    db = get_db()
    cursor = db.conn.cursor()
    
    # Check if harnesses already exist
    cursor.execute("SELECT COUNT(*) as count FROM harness_configs")
    if cursor.fetchone()["count"] > 0:
        return
    
    # Create default harnesses
    default_harnesses = [
        (
            "phaos",
            "PHAOS",
            "2.0.0",
            "The default harness with AV2 amplification + Alethea V2 grounding",
            "phaos.engine.orchestrator:orchestrator",
            1, 1, 1, 1, 1,  # All supported, active by default
        ),
        (
            "raw",
            "Raw Model",
            "1.0.0",
            "Direct LLM calls — no orchestration, no amplification, no grounding",
            "raw_model:direct_call",
            0, 0, 0, 0, 0,  # No tools, not active
        ),
        (
            "custom",
            "Custom Harness",
            "1.0.0",
            "User-uploaded harness (requires a ZIP file with Python code)",
            "custom:load_from_zip",
            0, 0, 0, 0, 0,  # No tools, not active
        ),
    ]
    
    for harness in default_harnesses:
        cursor.execute(
            """INSERT INTO harness_configs 
               (id, name, version, description, entry_point,
                supports_file_tools, supports_terminal, supports_git, supports_cron, is_active, created_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (*harness, _now_str()),
        )
    db.conn.commit()
