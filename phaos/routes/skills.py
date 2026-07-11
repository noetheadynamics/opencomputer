"""Skill routes — list, toggle, delete, and execute registered skills (SQLite-backed)."""

from __future__ import annotations

import json
import subprocess
import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from ..db.database import get_db
from ..db.schemas import Skill, SkillExecuteRequest, SkillExecuteResponse

router = APIRouter()


class SkillCreate(BaseModel):
    name: str
    description: str
    command: str


class SkillToggle(BaseModel):
    enabled: bool


@router.get("/", response_model=list[Skill])
async def list_skills():
    db = get_db()
    rows = db.conn.execute("SELECT * FROM skills ORDER BY name").fetchall()
    return [
        Skill(
            id=r["id"],
            name=r["name"],
            description=r["description"],
            command=r["command"],
            enabled=bool(r["enabled"]),
        )
        for r in rows
    ]


@router.get("/{skill_id}", response_model=Skill)
async def get_skill(skill_id: str):
    db = get_db()
    row = db.conn.execute("SELECT * FROM skills WHERE id = ?", (skill_id,)).fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Skill not found")
    return Skill(
        id=row["id"],
        name=row["name"],
        description=row["description"],
        command=row["command"],
        enabled=bool(row["enabled"]),
    )


@router.post("/", response_model=Skill)
async def create_skill(req: SkillCreate):
    skill_id = f"skill-{uuid.uuid4().hex[:8]}"
    db = get_db()
    db.conn.execute(
        "INSERT INTO skills (id, name, description, command) VALUES (?, ?, ?, ?)",
        (skill_id, req.name, req.description, req.command),
    )
    db.conn.commit()
    row = db.conn.execute("SELECT * FROM skills WHERE id = ?", (skill_id,)).fetchone()
    return Skill(
        id=row["id"],
        name=row["name"],
        description=row["description"],
        command=row["command"],
        enabled=bool(row["enabled"]),
    )


@router.patch("/{skill_id}")
async def toggle_skill(skill_id: str, body: SkillToggle):
    db = get_db()
    cursor = db.conn.execute(
        "UPDATE skills SET enabled = ? WHERE id = ?",
        (int(body.enabled), skill_id),
    )
    db.conn.commit()
    if cursor.rowcount == 0:
        raise HTTPException(status_code=404, detail="Skill not found")
    row = db.conn.execute("SELECT * FROM skills WHERE id = ?", (skill_id,)).fetchone()
    return Skill(
        id=row["id"],
        name=row["name"],
        description=row["description"],
        command=row["command"],
        enabled=bool(row["enabled"]),
    )


@router.delete("/{skill_id}")
async def delete_skill(skill_id: str):
    db = get_db()
    cursor = db.conn.execute("DELETE FROM skills WHERE id = ?", (skill_id,))
    db.conn.commit()
    if cursor.rowcount == 0:
        raise HTTPException(status_code=404, detail="Skill not found")
    return {"deleted": True}


@router.post("/execute", response_model=SkillExecuteResponse)
async def execute_skill(req: SkillExecuteRequest):
    db = get_db()
    row = db.conn.execute("SELECT * FROM skills WHERE id = ?", (req.skill_id,)).fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Skill not found")

    cmd = row["command"]
    for k, v in req.args.items():
        cmd = cmd.replace("{" + k + "}", v)

    try:
        result = subprocess.run(
            cmd,
            shell=False,
            capture_output=True,
            text=True,
            timeout=30,
        )
        return SkillExecuteResponse(
            skill_id=req.skill_id,
            output=result.stdout or result.stderr,
            exit_code=result.returncode,
        )
    except subprocess.TimeoutExpired:
        return SkillExecuteResponse(
            skill_id=req.skill_id, output="Command timed out", exit_code=-1
        )
    except Exception as e:
        return SkillExecuteResponse(
            skill_id=req.skill_id, output=str(e), exit_code=-1
        )
