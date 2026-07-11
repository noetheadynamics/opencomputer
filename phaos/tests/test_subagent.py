"""Tests for Phase 14: Subagent Manager — CRUD, toggle, test, routes."""

import os
import sys
import sqlite3
import pytest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from fastapi.testclient import TestClient
from phaos.main import app
from phaos.db.database import init_db
from phaos.core.subagent_manager import SubagentManager, get_subagent_manager, reset_subagent_manager

_test_counter = 0


@pytest.fixture(autouse=True)
def client():
    global _test_counter
    _test_counter += 1
    db_path = f"./test_subagent_{_test_counter}.db"
    import phaos.db.database as db_mod
    db_mod._db = None
    init_db(db_path)
    reset_subagent_manager()
    with TestClient(app) as c:
        yield c
    import phaos.db.database as db_mod
    db_mod._db = None
    try:
        os.remove(db_path)
    except OSError:
        pass


# ── SubagentManager Unit Tests ──────────────────────────────


class TestSubagentManager:
    def test_create_subagent(self):
        db = sqlite3.connect(":memory:")
        db.row_factory = sqlite3.Row
        mgr = SubagentManager(db)
        sid = mgr.create_subagent({"name": "Test Bot", "task_type": "coding", "system_prompt": "You are a coder"})
        assert sid is not None
        assert len(sid) == 12
        sa = mgr.get_subagent(sid)
        assert sa is not None
        assert sa["name"] == "Test Bot"
        assert sa["task_type"] == "coding"
        assert sa["system_prompt"] == "You are a coder"
        assert sa["enabled"] is True
        db.close()

    def test_get_all_subagents(self):
        db = sqlite3.connect(":memory:")
        db.row_factory = sqlite3.Row
        mgr = SubagentManager(db)
        mgr.create_subagent({"name": "Bot 1"})
        mgr.create_subagent({"name": "Bot 2"})
        all_sa = mgr.get_all_subagents()
        assert len(all_sa) == 2
        db.close()

    def test_get_nonexistent(self):
        db = sqlite3.connect(":memory:")
        db.row_factory = sqlite3.Row
        mgr = SubagentManager(db)
        assert mgr.get_subagent("nonexistent") is None
        db.close()

    def test_update_subagent(self):
        db = sqlite3.connect(":memory:")
        db.row_factory = sqlite3.Row
        mgr = SubagentManager(db)
        sid = mgr.create_subagent({"name": "Original"})
        assert mgr.update_subagent(sid, {"name": "Updated", "task_type": "vision"}) is True
        sa = mgr.get_subagent(sid)
        assert sa["name"] == "Updated"
        assert sa["task_type"] == "vision"
        db.close()

    def test_update_nonexistent(self):
        db = sqlite3.connect(":memory:")
        db.row_factory = sqlite3.Row
        mgr = SubagentManager(db)
        assert mgr.update_subagent("nope", {"name": "X"}) is False
        db.close()

    def test_delete_subagent(self):
        db = sqlite3.connect(":memory:")
        db.row_factory = sqlite3.Row
        mgr = SubagentManager(db)
        sid = mgr.create_subagent({"name": "To Delete"})
        assert mgr.delete_subagent(sid) is True
        assert mgr.get_subagent(sid) is None
        db.close()

    def test_delete_nonexistent(self):
        db = sqlite3.connect(":memory:")
        db.row_factory = sqlite3.Row
        mgr = SubagentManager(db)
        assert mgr.delete_subagent("nope") is False
        db.close()

    def test_toggle_subagent(self):
        db = sqlite3.connect(":memory:")
        db.row_factory = sqlite3.Row
        mgr = SubagentManager(db)
        sid = mgr.create_subagent({"name": "Toggle Me"})
        assert mgr.toggle_subagent(sid, False) is True
        sa = mgr.get_subagent(sid)
        assert sa["enabled"] is False
        assert mgr.toggle_subagent(sid, True) is True
        sa = mgr.get_subagent(sid)
        assert sa["enabled"] is True
        db.close()

    def test_test_subagent_no_callback(self):
        db = sqlite3.connect(":memory:")
        db.row_factory = sqlite3.Row
        mgr = SubagentManager(db)
        sid = mgr.create_subagent({"name": "Test"})
        result = mgr.test_subagent(sid, "hello")
        assert result["success"] is False
        assert "callback" in result["error"].lower() or "model" in result["error"].lower()
        db.close()

    def test_test_subagent_with_callback(self):
        db = sqlite3.connect(":memory:")
        db.row_factory = sqlite3.Row
        mgr = SubagentManager(db)
        mgr.set_model_callback(lambda q, **kw: f"Response to: {q}")
        sid = mgr.create_subagent({"name": "Test", "system_prompt": "Be helpful"})
        result = mgr.test_subagent(sid, "hello")
        assert result["success"] is True
        assert "Response to: hello" in result["response"]
        db.close()

    def test_test_subagent_disabled(self):
        db = sqlite3.connect(":memory:")
        db.row_factory = sqlite3.Row
        mgr = SubagentManager(db)
        mgr.set_model_callback(lambda q, **kw: "ok")
        sid = mgr.create_subagent({"name": "Disabled", "enabled": False})
        result = mgr.test_subagent(sid, "hello")
        assert result["success"] is False
        assert "disabled" in result["error"].lower()
        db.close()

    def test_tools_serialization(self):
        db = sqlite3.connect(":memory:")
        db.row_factory = sqlite3.Row
        mgr = SubagentManager(db)
        sid = mgr.create_subagent({"name": "Tools", "tools": ["read_file", "write_file"]})
        sa = mgr.get_subagent(sid)
        assert sa["tools"] == ["read_file", "write_file"]
        db.close()


# ── API Route Tests ─────────────────────────────────────────


class TestSubagentRoutes:
    def test_list_empty(self, client):
        res = client.get("/api/subagents/")
        assert res.status_code == 200
        assert "subagents" in res.json()
        assert isinstance(res.json()["subagents"], list)

    def test_create(self, client):
        res = client.post("/api/subagents/", json={"name": "My Bot", "task_type": "coding"})
        assert res.status_code == 200
        data = res.json()
        assert data["success"] is True
        assert "id" in data

    def test_get_subagent(self, client):
        r = client.post("/api/subagents/", json={"name": "Get Me"}).json()
        res = client.get(f"/api/subagents/{r['id']}")
        assert res.status_code == 200
        assert res.json()["name"] == "Get Me"

    def test_get_nonexistent(self, client):
        res = client.get("/api/subagents/nonexistent")
        assert res.status_code == 404

    def test_update(self, client):
        r = client.post("/api/subagents/", json={"name": "Old"}).json()
        res = client.put(f"/api/subagents/{r['id']}", json={"name": "New"})
        assert res.status_code == 200
        assert res.json()["success"] is True
        sa = client.get(f"/api/subagents/{r['id']}").json()
        assert sa["name"] == "New"

    def test_update_nonexistent(self, client):
        res = client.put("/api/subagents/nope", json={"name": "X"})
        assert res.status_code == 404

    def test_delete(self, client):
        r = client.post("/api/subagents/", json={"name": "Del"}).json()
        res = client.delete(f"/api/subagents/{r['id']}")
        assert res.status_code == 200
        assert res.json()["success"] is True
        assert client.get(f"/api/subagents/{r['id']}").status_code == 404

    def test_delete_nonexistent(self, client):
        res = client.delete("/api/subagents/nope")
        assert res.status_code == 404

    def test_toggle(self, client):
        r = client.post("/api/subagents/", json={"name": "Toggle"}).json()
        res = client.post(f"/api/subagents/{r['id']}/toggle?enabled=false")
        assert res.status_code == 200
        sa = client.get(f"/api/subagents/{r['id']}").json()
        assert sa["enabled"] is False

    def test_toggle_nonexistent(self, client):
        res = client.post("/api/subagents/nope/toggle?enabled=true")
        assert res.status_code == 404

    def test_test_subagent(self, client):
        r = client.post("/api/subagents/", json={"name": "Tester"}).json()
        res = client.post(f"/api/subagents/{r['id']}/test", json={"query": "hello"})
        assert res.status_code == 200
        data = res.json()
        assert "success" in data

    def test_create_with_tools(self, client):
        res = client.post("/api/subagents/", json={"name": "ToolBot", "tools": ["read_file", "web_search"]})
        assert res.status_code == 200
        sid = res.json()["id"]
        sa = client.get(f"/api/subagents/{sid}").json()
        assert sa["tools"] == ["read_file", "web_search"]
