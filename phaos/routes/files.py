"""File management API — CRUD for project files (replaces browser mock)."""

from __future__ import annotations

import os
import shutil
from pathlib import Path
from typing import Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

router = APIRouter()

# Workspace root — where the app stores project files
WORKSPACE_ROOT = os.getenv("PHAOS_WORKSPACE", os.path.join(os.path.dirname(__file__), "..", "..", "workspace"))


def _safe_path(path: str) -> str:
    """Resolve and validate path against workspace root."""
    root = os.path.realpath(WORKSPACE_ROOT)
    target = os.path.realpath(os.path.join(root, path.lstrip("/")))
    if not target.startswith(root):
        raise HTTPException(status_code=403, detail="Path traversal not allowed")
    return target


def _entry_dict(name: str, full_path: str, rel_path: str) -> dict:
    stat = os.stat(full_path)
    return {
        "name": name,
        "path": "/" + rel_path.replace("\\", "/"),
        "is_dir": os.path.isdir(full_path),
        "size": stat.st_size if os.path.isfile(full_path) else 0,
        "modified": int(stat.st_mtime * 1000),
    }


class WriteFileRequest(BaseModel):
    path: str
    content: str


class RenameRequest(BaseModel):
    old_path: str
    new_path: str


class UploadRequest(BaseModel):
    path: str
    content: str
    name: str


@router.get("")
@router.get("/")
async def list_directory(path: str = "/"):
    full = _safe_path(path)
    if not os.path.exists(full):
        raise HTTPException(status_code=404, detail="Directory not found")
    if not os.path.isdir(full):
        raise HTTPException(status_code=400, detail="Not a directory")

    root = os.path.realpath(WORKSPACE_ROOT)
    entries = []
    try:
        for name in sorted(os.listdir(full)):
            child_full = os.path.join(full, name)
            child_rel = os.path.relpath(child_full, root)
            entries.append(_entry_dict(name, child_full, child_rel))
    except PermissionError:
        raise HTTPException(status_code=403, detail="Permission denied")

    # Sort: dirs first, then alphabetical
    entries.sort(key=lambda e: (not e["is_dir"], e["name"].lower()))
    return entries


@router.get("/read")
async def read_file(path: str):
    full = _safe_path(path)
    if not os.path.exists(full):
        raise HTTPException(status_code=404, detail="File not found")
    if os.path.isdir(full):
        raise HTTPException(status_code=400, detail="Cannot read a directory")
    try:
        with open(full, "r", encoding="utf-8", errors="replace") as f:
            return {"content": f.read()}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/write")
async def write_file(req: WriteFileRequest):
    full = _safe_path(req.path)
    os.makedirs(os.path.dirname(full), exist_ok=True)
    try:
        with open(full, "w", encoding="utf-8") as f:
            f.write(req.content)
        return {"success": True, "path": req.path}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/mkdir")
async def create_folder(req: WriteFileRequest):
    full = _safe_path(req.path)
    if os.path.exists(full):
        raise HTTPException(status_code=409, detail="Already exists")
    try:
        os.makedirs(full, exist_ok=True)
        return {"success": True, "path": req.path}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/rename")
async def rename_file(req: RenameRequest):
    old_full = _safe_path(req.old_path)
    new_full = _safe_path(req.new_path)
    if not os.path.exists(old_full):
        raise HTTPException(status_code=404, detail="Source not found")
    if os.path.exists(new_full):
        raise HTTPException(status_code=409, detail="Destination already exists")
    try:
        os.rename(old_full, new_full)
        return {"success": True}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/move")
async def move_file(req: RenameRequest):
    return await rename_file(req)


@router.delete("")
async def delete_file(path: str):
    full = _safe_path(path)
    if not os.path.exists(full):
        raise HTTPException(status_code=404, detail="File not found")
    try:
        if os.path.isdir(full):
            shutil.rmtree(full)
        else:
            os.remove(full)
        return {"success": True}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/upload")
async def upload_file(req: UploadRequest):
    full_path = _safe_path(req.path)
    full = os.path.join(full_path, req.name)
    os.makedirs(full_path, exist_ok=True)
    try:
        with open(full, "w", encoding="utf-8") as f:
            f.write(req.content)
        return {"success": True, "path": "/" + os.path.relpath(full, os.path.realpath(WORKSPACE_ROOT)).replace("\\", "/")}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/metadata")
async def get_metadata(path: str):
    full = _safe_path(path)
    if not os.path.exists(full):
        raise HTTPException(status_code=404, detail="File not found")
    stat = os.stat(full)
    root = os.path.realpath(WORKSPACE_ROOT)
    rel = os.path.relpath(full, root)
    return {
        "name": os.path.basename(full),
        "path": "/" + rel.replace("\\", "/"),
        "is_dir": os.path.isdir(full),
        "size": stat.st_size if os.path.isfile(full) else 0,
        "modified": int(stat.st_mtime * 1000),
        "created": int(stat.st_ctime * 1000),
    }
