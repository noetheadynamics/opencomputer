"""Tests for PHAOS backend routes."""

import pytest
from fastapi.testclient import TestClient

from phaos.main import app

client = TestClient(app)


def test_health():
    r = client.get("/health")
    assert r.status_code == 200
    assert r.json()["status"] == "ok"


# ── Tasks ─────────────────────────────────────────────────────────────


def test_create_and_get_task():
    r = client.post("/api/tasks/", json={"prompt": "Do something"})
    assert r.status_code == 200
    data = r.json()
    assert data["prompt"] == "Do something"
    assert data["status"] == "pending"
    task_id = data["id"]

    r2 = client.get(f"/api/tasks/{task_id}")
    assert r2.status_code == 200
    assert r2.json()["id"] == task_id


def test_list_tasks():
    r = client.get("/api/tasks/")
    assert r.status_code == 200
    assert isinstance(r.json(), list)
    assert len(r.json()) >= 1


def test_update_task():
    r = client.post("/api/tasks/", json={"prompt": "Update me"})
    task_id = r.json()["id"]

    r2 = client.patch(f"/api/tasks/{task_id}", json={"status": "running"})
    assert r2.status_code == 200
    assert r2.json()["status"] == "running"


def test_get_task_not_found():
    r = client.get("/api/tasks/nonexistent")
    assert r.status_code == 404


# ── Harness Slots ─────────────────────────────────────────────────────


def test_list_slots():
    r = client.get("/api/harness/slots")
    assert r.status_code == 200
    slots = r.json()
    assert len(slots) == 4
    assert all(s["status"] == "available" for s in slots)


def test_acquire_and_release_slot():
    r = client.post(
        "/api/harness/acquire",
        json={"slot_id": "slot-0", "task_id": "task-abc"},
    )
    assert r.status_code == 200
    assert r.json()["status"] == "occupied"
    assert r.json()["owner_task_id"] == "task-abc"

    r2 = client.post("/api/harness/release", json={"slot_id": "slot-0"})
    assert r2.status_code == 200
    assert r2.json()["status"] == "available"


def test_acquire_occupied_slot_fails():
    client.post("/api/harness/acquire", json={"slot_id": "slot-1", "task_id": "t1"})
    r = client.post("/api/harness/acquire", json={"slot_id": "slot-1", "task_id": "t2"})
    assert r.status_code == 409


# ── Skills ────────────────────────────────────────────────────────────


def test_list_skills():
    r = client.get("/api/skills/")
    assert r.status_code == 200
    skills = r.json()
    assert len(skills) >= 3


def test_execute_skill():
    r = client.post(
        "/api/skills/execute",
        json={"skill_id": "skill-run-command", "args": {"command": "ls"}},
    )
    assert r.status_code == 200
    assert r.json()["exit_code"] == 0
    assert "ls" in r.json()["output"]


def test_execute_unknown_skill_fails():
    r = client.post(
        "/api/skills/execute",
        json={"skill_id": "nonexistent", "args": {}},
    )
    assert r.status_code == 404
