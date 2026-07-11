"""Tests for Phase 10: Memory API routes."""

import pytest
import tempfile
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from fastapi.testclient import TestClient
from phaos.main import app
from phaos.core.memory_store import MemoryStore
from phaos.routes import memory as memory_mod


@pytest.fixture(autouse=True)
def client():
    """Set up fresh memory store and test client."""
    fd, db_path = tempfile.mkstemp(suffix=".db")
    os.close(fd)
    memory_mod._memory_store = MemoryStore(db_path)
    memory_mod._feedback_loop = None
    memory_mod._truth_vault.clear()
    memory_mod._cross_session_state = {
        "milestones": [],
        "open_issues": [],
        "failed_attempts": [],
        "known_blockers": [],
        "skills_learned": [],
    }
    memory_mod._feedback_store.clear()
    test_client = TestClient(app)
    yield test_client
    try:
        os.unlink(db_path)
    except PermissionError:
        pass


# ── Truth Vault ─────────────────────────────────────────────────────


class TestTruthVault:
    def test_get_empty(self, client):
        res = client.get("/api/memory/truth-vault")
        assert res.status_code == 200
        assert res.json() == []

    def test_add_and_get_fact(self, client):
        memory_mod._truth_vault.append({
            "id": "f1",
            "query": "What is Python?",
            "answer": "A programming language",
            "sources": ["wiki"],
            "fact_type": "factual",
            "created_at": "2026-01-01T00:00:00",
            "expires_at": "2026-12-31T23:59:59",
            "is_expired": False,
        })
        res = client.get("/api/memory/truth-vault")
        assert res.status_code == 200
        data = res.json()
        assert len(data) == 1
        assert data[0]["query"] == "What is Python?"

    def test_filter_by_type(self, client):
        memory_mod._truth_vault.extend([
            {"id": "f1", "query": "q1", "answer": "a1", "fact_type": "factual"},
            {"id": "f2", "query": "q2", "answer": "a2", "fact_type": "procedural"},
        ])
        res = client.get("/api/memory/truth-vault?fact_type=factual")
        data = res.json()
        assert len(data) == 1

    def test_delete_fact(self, client):
        memory_mod._truth_vault.append({"id": "f1", "query": "q"})
        res = client.delete("/api/memory/truth-vault/f1")
        assert res.status_code == 200
        assert len(memory_mod._truth_vault) == 0

    def test_delete_nonexistent(self, client):
        res = client.delete("/api/memory/truth-vault/nonexistent")
        assert res.status_code == 404


# ── Cross-Session State ─────────────────────────────────────────────


class TestCrossSessionState:
    def test_get_state(self, client):
        res = client.get("/api/memory/cross-session-state")
        assert res.status_code == 200
        data = res.json()
        assert "milestones" in data
        assert "skills_learned" in data

    def test_delete_milestone(self, client):
        memory_mod._cross_session_state["milestones"] = ["Phase 9 complete"]
        res = client.delete("/api/memory/cross-session-state/milestone/Phase 9 complete")
        assert res.status_code == 200
        assert len(memory_mod._cross_session_state["milestones"]) == 0

    def test_delete_nonexistent_milestone(self, client):
        res = client.delete("/api/memory/cross-session-state/milestone/none")
        assert res.status_code == 404


# ── Memory Store ────────────────────────────────────────────────────


class TestMemoryStore:
    def test_get_empty(self, client):
        res = client.get("/api/memory/memory-store")
        assert res.status_code == 200
        assert res.json() == []

    def test_store_and_get(self, client):
        ms = memory_mod._get_memory_store()
        ms.store_interaction("test query", "test response", success=True)
        res = client.get("/api/memory/memory-store")
        data = res.json()
        assert len(data) == 1
        assert data[0]["query"] == "test query"

    def test_filter_success_only(self, client):
        ms = memory_mod._get_memory_store()
        ms.store_interaction("q1", "r1", success=True)
        ms.store_interaction("q2", "r2", success=False)
        res = client.get("/api/memory/memory-store?success_only=true")
        data = res.json()
        assert all(i["success"] == 1 for i in data)

    def test_search(self, client):
        ms = memory_mod._get_memory_store()
        ms.store_interaction("Python tutorial", "Learn Python", success=True)
        res = client.get("/api/memory/memory-store?query=Python")
        data = res.json()
        assert len(data) >= 1

    def test_delete_interaction(self, client):
        ms = memory_mod._get_memory_store()
        iid = ms.store_interaction("q", "r", success=True)
        res = client.delete(f"/api/memory/memory-store/{iid}")
        assert res.status_code == 200

    def test_delete_nonexistent(self, client):
        res = client.delete("/api/memory/memory-store/nonexistent")
        assert res.status_code == 404

    def test_store_interaction(self, client):
        res = client.post("/api/memory/memory-store", json={
            "query": "new query",
            "response": "new response",
            "success": True,
        })
        assert res.status_code == 200
        assert "id" in res.json()


# ── Stats ───────────────────────────────────────────────────────────


class TestStats:
    def test_get_stats(self, client):
        res = client.get("/api/memory/stats")
        assert res.status_code == 200
        data = res.json()
        assert "truth_vault_count" in data
        assert "memory_store_count" in data
        assert "conversations_count" in data


# ── Export ──────────────────────────────────────────────────────────


class TestExport:
    def test_export(self, client):
        res = client.post("/api/memory/export")
        assert res.status_code == 200
        assert res.headers["content-type"] == "application/zip"
        assert "opencomputer_memory_export.zip" in res.headers.get("content-disposition", "")

    def test_export_contains_zip(self, client):
        import zipfile
        import io
        res = client.post("/api/memory/export")
        zip_data = io.BytesIO(res.content)
        with zipfile.ZipFile(zip_data) as zf:
            names = zf.namelist()
            assert "truth_vault.json" in names
            assert "cross_session_state.json" in names
            assert "memory_store.json" in names


# ── Cleanup ─────────────────────────────────────────────────────────


class TestCleanup:
    def test_cleanup(self, client):
        ms = memory_mod._get_memory_store()
        ms.store_interaction("old q", "old r", success=True)
        res = client.post("/api/memory/cleanup", json={"days": 30})
        assert res.status_code == 200
        assert res.json()["success"] is True


# ── Corrections / Feedback ──────────────────────────────────────────


class TestCorrections:
    def test_store_correction(self, client):
        res = client.post("/api/memory/corrections", json={
            "query": "test",
            "original_response": "wrong",
            "corrected_response": "right",
        })
        assert res.status_code == 200
        assert "id" in res.json()

    def test_store_feedback_up(self, client):
        res = client.post("/api/memory/feedback/msg1", json={"type": "up"})
        assert res.status_code == 200
        assert res.json()["success"] is True

    def test_store_feedback_down(self, client):
        res = client.post("/api/memory/feedback/msg1", json={"type": "down"})
        assert res.status_code == 200

    def test_invalid_feedback_type(self, client):
        res = client.post("/api/memory/feedback/msg1", json={"type": "invalid"})
        assert res.status_code == 400


# ── Unified Search ──────────────────────────────────────────────────


class TestSearch:
    def test_search_all(self, client):
        memory_mod._truth_vault.append({
            "id": "f1", "query": "Python basics", "answer": "Learn Python",
        })
        ms = memory_mod._get_memory_store()
        ms.store_interaction("Python basics", "Python tutorial", success=True)
        res = client.get("/api/memory/search?q=Python")
        assert res.status_code == 200
        data = res.json()
        assert "truth_vault" in data
        assert "memory_store" in data
        assert "conversations" in data
        assert len(data["truth_vault"]) >= 1
