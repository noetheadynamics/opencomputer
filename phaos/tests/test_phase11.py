"""Tests for Phase 11: Background Tasks, Compact Context, Routing, Performance, Preferences."""

import pytest
import os
import sys
import json
import tempfile

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from fastapi.testclient import TestClient
from phaos.main import app
from phaos.db.database import init_db
from phaos.core.compact_context import CompactContext

_test_counter = 0


@pytest.fixture(autouse=True)
def client():
    global _test_counter
    _test_counter += 1
    db_path = f"./test_phase11_{_test_counter}.db"
    import phaos.db.database as db_mod
    db_mod._db = None
    init_db(db_path)
    # Reset singletons
    import phaos.core.background_tasks as bt_mod
    import phaos.core.user_preferences as pref_mod
    import phaos.core.performance_monitor as perf_mod
    import phaos.routes.routing as routing_mod
    bt_mod._task_manager = None
    pref_mod._preferences = None
    perf_mod._monitor = None
    routing_mod._ensure_table()
    client = TestClient(app)
    yield client
    try:
        os.unlink(db_path)
    except (PermissionError, FileNotFoundError):
        pass


# ── Background Tasks ────────────────────────────────────────────────


class TestBackgroundTasks:
    def test_create_task(self, client):
        res = client.post("/api/background-tasks/create", json={
            "session_id": "s1",
            "task_type": "coding",
            "payload": {"message": "write code"},
        })
        assert res.status_code == 200
        assert "task_id" in res.json()

    def test_get_session_tasks(self, client):
        client.post("/api/background-tasks/create", json={
            "session_id": "s1",
            "task_type": "coding",
        })
        res = client.get("/api/background-tasks/session/s1")
        assert res.status_code == 200
        assert len(res.json()["tasks"]) >= 1

    def test_get_task_status(self, client):
        r = client.post("/api/background-tasks/create", json={
            "session_id": "s1",
            "task_type": "reasoning",
        })
        task_id = r.json()["task_id"]
        res = client.get(f"/api/background-tasks/{task_id}/status")
        assert res.status_code == 200
        assert res.json()["status"] == "queued"

    def test_cancel_task(self, client):
        r = client.post("/api/background-tasks/create", json={
            "session_id": "s1",
            "task_type": "general",
        })
        task_id = r.json()["task_id"]
        res = client.delete(f"/api/background-tasks/{task_id}")
        assert res.status_code == 200
        assert res.json()["success"] is True

    def test_get_nonexistent_task(self, client):
        res = client.get("/api/background-tasks/nonexistent/status")
        assert res.status_code == 404


# ── Compact Context ─────────────────────────────────────────────────


class TestCompactContext:
    def test_count_tokens(self):
        ctx = CompactContext("default")
        tokens = ctx.count_tokens("Hello world")
        assert tokens > 0

    def test_should_compact_false(self):
        ctx = CompactContext("default")
        messages = [{"role": "user", "content": "hi"}]
        usage = ctx.get_usage(messages)
        assert usage["should_auto_compact"] is False

    def test_should_compact_true(self):
        ctx = CompactContext("default")
        messages = [{"role": "user", "content": "x " * 10000}]
        usage = ctx.get_usage(messages)
        assert usage["should_auto_compact"] is True

    def test_compact_no_change_when_short(self):
        ctx = CompactContext("default")
        messages = [{"role": "user", "content": "hi"}, {"role": "assistant", "content": "hello"}]
        result = ctx.compact(messages, start=0, end=2, summary="Hi and hello")
        assert len(result) == 1  # summary replaces both

    def test_compact_reduces_messages(self):
        ctx = CompactContext("default")
        messages = [{"role": "user", "content": "x " * 10000} for _ in range(20)]
        result = ctx.compact(messages, start=0, end=15, summary="15 messages about x")
        assert len(result) <= 6  # summary + 5 recent

    def test_compact_preserves_protected(self):
        ctx = CompactContext("default")
        messages = [
            {"role": "user", "content": "msg 1"},
            {"role": "assistant", "content": "msg 2", "protected": True},
            {"role": "user", "content": "msg 3"},
        ]
        result = ctx.compact(messages, start=0, end=3, summary="summary")
        assert any(m.get("protected") for m in result)

    def test_discard_removes_messages(self):
        ctx = CompactContext("default")
        messages = [
            {"role": "user", "content": "question"},
            {"role": "assistant", "content": "tool output"},
            {"role": "user", "content": "follow up"},
        ]
        result = ctx.discard(messages, message_ids=[1])
        assert len(result) == 2

    def test_discard_preserves_user_messages(self):
        ctx = CompactContext("default")
        messages = [{"role": "user", "content": "important"}]
        result = ctx.discard(messages, message_ids=[0])
        assert len(result) == 1  # user messages never discarded

    def test_protect_marks_messages(self):
        ctx = CompactContext("default")
        messages = [{"role": "assistant", "content": "important"}]
        ctx.protect(messages, message_ids=[0])
        assert messages[0].get("protected") is True

    def test_prune_removes_tool_calls(self):
        ctx = CompactContext("default")
        messages = [
            {"role": "assistant", "tool_call_id": "tc_1"},
            {"role": "user", "content": "response"},
        ]
        result = ctx.prune(messages, tool_call_ids=["tc_1"])
        assert len(result) == 1

    def test_get_usage(self):
        ctx = CompactContext("default")
        messages = [{"role": "user", "content": "Hello"}]
        usage = ctx.get_usage(messages)
        assert "total" in usage
        assert "max" in usage
        assert "used_percent" in usage
        assert "should_auto_compact" in usage

    def test_compact_api(self, client):
        res = client.post("/api/compact/conversation/tokens", json={
            "conversation_id": "nonexistent",
        })
        assert res.status_code == 200
        assert "total" in res.json()


# ── User Preferences ────────────────────────────────────────────────


class TestUserPreferences:
    def test_set_and_get(self, client):
        res = client.put("/api/preferences/theme", json={"key": "theme", "value": "dark"})
        assert res.status_code == 200
        res = client.get("/api/preferences/theme")
        assert res.json()["value"] == "dark"

    def test_get_all(self, client):
        client.put("/api/preferences/a", json={"key": "a", "value": 1})
        client.put("/api/preferences/b", json={"key": "b", "value": 2})
        res = client.get("/api/preferences")
        data = res.json()
        assert "a" in data
        assert "b" in data

    def test_delete(self, client):
        client.put("/api/preferences/to_delete", json={"key": "to_delete", "value": "x"})
        res = client.delete("/api/preferences/to_delete")
        assert res.json()["success"] is True
        res = client.get("/api/preferences/to_delete")
        assert res.json()["value"] is None

    def test_upsert(self, client):
        client.put("/api/preferences/k", json={"key": "k", "value": "v1"})
        client.put("/api/preferences/k", json={"key": "k", "value": "v2"})
        res = client.get("/api/preferences/k")
        assert res.json()["value"] == "v2"


# ── Model Routing ───────────────────────────────────────────────────


class TestRouting:
    def test_get_rules(self, client):
        res = client.get("/api/routing/rules")
        assert res.status_code == 200
        rules = res.json()
        assert len(rules) >= 6
        task_types = [r["task_type"] for r in rules]
        assert "coding" in task_types
        assert "vision" in task_types

    def test_update_rule(self, client):
        res = client.put("/api/routing/rules/coding", json={
            "task_type": "coding",
            "provider_id": "openai",
            "model_name": "gpt-4",
        })
        assert res.status_code == 200
        assert res.json()["success"] is True

    def test_test_model(self, client):
        res = client.post("/api/routing/test?provider_id=openai&model_name=gpt-4")
        assert res.status_code == 200
        assert res.json()["success"] is True


# ── Performance Monitoring ──────────────────────────────────────────


class TestPerformance:
    def test_record_and_get(self, client):
        res = client.post("/api/performance/record", json={
            "session_id": "s1",
            "provider": "openai",
            "model": "gpt-4",
            "tokens_in": 100,
            "tokens_out": 200,
            "latency_ms": 500,
            "success": True,
        })
        assert res.status_code == 200

        res = client.get("/api/performance/session/s1")
        data = res.json()
        assert data["summary"]["total_calls"] >= 1
        assert data["summary"]["total_tokens"] >= 300

    def test_model_stats(self, client):
        client.post("/api/performance/record", json={
            "session_id": "s1",
            "provider": "openai",
            "model": "gpt-4",
            "tokens_in": 50,
            "tokens_out": 100,
            "latency_ms": 300,
            "success": True,
        })
        res = client.get("/api/performance/session/s1")
        assert "openai/gpt-4" in res.json()["by_model"]

    def test_export(self, client):
        res = client.get("/api/performance/session/s1/export")
        assert res.status_code == 200
        assert "summary" in res.json()
        assert "records" in res.json()

    def test_empty_session(self, client):
        res = client.get("/api/performance/session/empty")
        assert res.status_code == 200
        assert res.json()["summary"]["total_calls"] == 0
