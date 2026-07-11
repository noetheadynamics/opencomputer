"""Skill routes — list and execute registered skills."""

from fastapi import APIRouter, HTTPException

from ..db import store
from ..db.schemas import Skill, SkillExecuteRequest, SkillExecuteResponse

router = APIRouter()


@router.get("/", response_model=list[Skill])
async def list_skills():
    return store.list_skills()


@router.get("/{skill_id}", response_model=Skill)
async def get_skill(skill_id: str):
    skill = store.get_skill(skill_id)
    if not skill:
        raise HTTPException(status_code=404, detail="Skill not found")
    return skill


@router.post("/execute", response_model=SkillExecuteResponse)
async def execute_skill(req: SkillExecuteRequest):
    skill = store.get_skill(req.skill_id)
    if not skill:
        raise HTTPException(status_code=404, detail="Skill not found")
    # Scaffold: returns mock output; Phase 6 wires real execution
    cmd = skill.command
    for k, v in req.args.items():
        cmd = cmd.replace("{" + k + "}", v)
    return SkillExecuteResponse(
        skill_id=skill.id,
        output=f"[PHAOS scaffold] Would execute: {cmd}",
        exit_code=0,
    )
