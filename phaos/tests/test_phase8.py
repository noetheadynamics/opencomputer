"""Tests for Phase 8: Memory, Self-Teaching, Auto-Retry, Feedback, Streaming, Vision, Model Merging."""

import pytest
import tempfile
import os
import sys
import asyncio
import json

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from core.memory_store import MemoryStore
from core.self_teaching import SelfTeachingLoop
from core.auto_retry import AutoRetryLoop
from core.feedback_loop import FeedbackLoop
from core.streaming import ReActStreamer
from core.integration.vision_adapter import VisionAdapter
from core.integration.model_merging import ModelMerger


# ── Part 1: Memory Store ──────────────────────────────────────────────


class TestMemoryStore:
    """Tests for SQLite FTS5 Memory Store."""

    @pytest.fixture(autouse=True)
    def store(self):
        self._db_fd, db_path = tempfile.mkstemp(suffix=".db")
        os.close(self._db_fd)
        s = MemoryStore(db_path)
        self._db_path = db_path
        yield s
        try:
            os.unlink(db_path)
        except PermissionError:
            pass

    def test_store_and_retrieve(self, store):
        mid = store.store_interaction("hello", "world", success=True)
        assert mid is not None
        interaction = store.get_interaction(mid)
        assert interaction is not None
        assert interaction["query"] == "hello"
        assert interaction["response"] == "world"
        assert interaction["success"] == 1

    def test_retrieve_similar(self, store):
        store.store_interaction("python list comprehension", "Use [x for x in ...]", success=True)
        store.store_interaction("python dict comprehension", "Use {k: v for ...}", success=True)
        store.store_interaction("rust ownership", "Values have single owners", success=True)

        results = store.retrieve_similar("python", top_k=2)
        assert len(results) == 2

    def test_store_failure(self, store):
        mid = store.store_failure("broken code", "SyntaxError", "def foo(")
        interaction = store.get_interaction(mid)
        assert interaction["success"] == 0

    def test_corrections(self, store):
        store.store_interaction("how to print", "print(x)", success=True, user_correction="Use print(x, end='')")
        corrections = store.get_corrections_for_query("how to print")
        assert len(corrections) > 0
        assert corrections[0] == "Use print(x, end='')"

    def test_stats(self, store):
        store.store_interaction("q1", "r1", success=True)
        store.store_interaction("q2", "r2", success=False)
        stats = store.get_stats()
        assert stats["total"] == 2
        assert stats["successful"] == 1
        assert stats["failed"] == 1


# ── Part 2: Self-Teaching Loop ────────────────────────────────────────


class TestSelfTeaching:
    """Tests for Self-Teaching Loop."""

    @pytest.fixture(autouse=True)
    def store_and_teaching(self):
        self._db_fd, db_path = tempfile.mkstemp(suffix=".db")
        os.close(self._db_fd)
        store = MemoryStore(db_path)
        teaching = SelfTeachingLoop(store)
        self._db_path = db_path
        yield store, teaching
        try:
            os.unlink(db_path)
        except PermissionError:
            pass

    def test_reflect_success(self, store_and_teaching):
        store, teaching = store_and_teaching
        mid = store.store_interaction("write a python function", "def foo(): pass", success=True)
        result = teaching.reflect(mid)
        assert result["reflected"] is True
        assert result["type"] == "success"

    def test_reflect_failure(self, store_and_teaching):
        store, teaching = store_and_teaching
        mid = store.store_interaction("fix the bug", "tried X", success=False, metadata={"error": "TypeError"})
        result = teaching.reflect(mid)
        assert result["reflected"] is True
        assert result["type"] == "failure"

    def test_extract_pattern(self, store_and_teaching):
        _, teaching = store_and_teaching
        pattern = teaching._extract_pattern("write a function", "code here")
        assert pattern == "code_generation"

    def test_extract_tags(self, store_and_teaching):
        _, teaching = store_and_teaching
        tags = teaching._extract_tags("write a python api endpoint")
        assert "python" in tags
        assert "api" in tags

    def test_get_learnings(self, store_and_teaching):
        store, teaching = store_and_teaching
        store.store_interaction("write python code", "def foo(): pass", success=True, metadata={"type": "learning", "pattern": "code_generation", "tags": ["python"]})
        learnings = teaching.get_learnings("python code")
        assert len(learnings) > 0


# ── Part 3: Auto-Retry Loop ──────────────────────────────────────────


class TestAutoRetry:
    """Tests for Auto-Retry Loop."""

    def test_success_on_first_try(self):
        retry = AutoRetryLoop(max_retries=3)

        async def ok_callback(q):
            return {"success": True, "result": "done"}

        result = asyncio.run(retry.execute_with_retry("test", ok_callback))
        assert result["success"] is True
        assert result["attempts"] == 1

    def test_success_on_retry(self):
        retry = AutoRetryLoop(max_retries=3)
        call_count = 0

        async def eventually_ok(q):
            nonlocal call_count
            call_count += 1
            if call_count < 3:
                return {"success": False, "error": "fail"}
            return {"success": True, "result": "done"}

        result = asyncio.run(retry.execute_with_retry("test", eventually_ok))
        assert result["success"] is True
        assert result["attempts"] == 3

    def test_all_retries_exhausted(self):
        retry = AutoRetryLoop(max_retries=2)

        async def always_fail(q):
            return {"success": False, "error": "always fails"}

        result = asyncio.run(retry.execute_with_retry("test", always_fail))
        assert result["success"] is False
        assert result["attempts"] == 2

    def test_exception_handling(self):
        retry = AutoRetryLoop(max_retries=2)

        async def raises_error(q):
            raise ValueError("boom")

        result = asyncio.run(retry.execute_with_retry("test", raises_error))
        assert result["success"] is False
        assert "boom" in result["error"]


# ── Part 4: Feedback Loop ────────────────────────────────────────────


class TestFeedbackLoop:
    """Tests for Feedback Loop."""

    @pytest.fixture(autouse=True)
    def store_and_feedback(self):
        self._db_fd, db_path = tempfile.mkstemp(suffix=".db")
        os.close(self._db_fd)
        store = MemoryStore(db_path)
        feedback = FeedbackLoop(store)
        self._db_path = db_path
        yield store, feedback
        try:
            os.unlink(db_path)
        except PermissionError:
            pass

    def test_store_correction(self, store_and_feedback):
        store, feedback = store_and_feedback
        mid = feedback.store_correction("how to print", "print(x)", "print(x, end='')")
        assert mid is not None

    def test_apply_corrections(self, store_and_feedback):
        store, feedback = store_and_feedback
        feedback.store_correction("how to print", "print(x)", "print(x, end='')")
        corrected = feedback.apply_corrections("how to print", "print(x)")
        assert corrected == "print(x, end='')"

    def test_no_corrections(self, store_and_feedback):
        _, feedback = store_and_feedback
        result = feedback.apply_corrections("no corrections", "original")
        assert result == "original"

    def test_has_corrections(self, store_and_feedback):
        _, feedback = store_and_feedback
        assert not feedback.has_corrections("how to print")
        feedback.store_correction("how to print", "print(x)", "print(x, end='')")
        assert feedback.has_corrections("how to print")


# ── Part 5: Streaming ────────────────────────────────────────────────


class TestStreaming:
    """Tests for ReAct Streamer."""

    def test_subscribe_and_emit(self):
        streamer = ReActStreamer()

        async def _test():
            queue = streamer.subscribe("task-1")
            await streamer.emit("task-1", "thought", "Thinking about the problem")
            step = await asyncio.wait_for(queue.get(), timeout=1.0)
            return step

        step = asyncio.run(_test())
        data = json.loads(step)
        assert data["type"] == "thought"
        assert data["content"] == "Thinking about the problem"

    def test_complete(self):
        streamer = ReActStreamer()

        async def _test():
            queue = streamer.subscribe("task-2")
            await streamer.emit("task-2", "action", "Running code")
            await streamer.complete("task-2")
            step1 = await asyncio.wait_for(queue.get(), timeout=1.0)
            step2 = await asyncio.wait_for(queue.get(), timeout=1.0)
            return step1, step2

        step1, step2 = asyncio.run(_test())
        assert json.loads(step1)["type"] == "action"
        assert step2 is None

    def test_unsubscribe(self):
        streamer = ReActStreamer()
        streamer.subscribe("task-3")
        streamer.unsubscribe("task-3")
        assert "task-3" not in streamer._queues

    def test_emit_to_nonexistent(self):
        streamer = ReActStreamer()

        async def _test():
            await streamer.emit("nonexistent", "thought", "test")

        asyncio.run(_test())


# ── Part 8: Vision Adapter ───────────────────────────────────────────


class TestVisionAdapter:
    """Tests for Vision Model Integration."""

    def test_not_configured(self):
        adapter = VisionAdapter({})
        assert not adapter.is_configured()
        status = adapter.get_status()
        assert status["configured"] is False

    def test_configured(self):
        adapter = VisionAdapter({
            "vision_enabled": True,
            "vision_base_url": "http://localhost:8080",
            "vision_api_key": "test-key",
            "vision_model": "test-model",
        })
        assert adapter.is_configured()

    def test_fallback_when_not_configured(self):
        adapter = VisionAdapter({})
        result = asyncio.run(adapter.process_design_query("design a button"))
        assert result["success"] is False
        assert result["fallback"] is True


# ── Part 9: Model Merging ────────────────────────────────────────────


class TestModelMerger:
    """Tests for Model Merging."""

    def test_register_model(self):
        merger = ModelMerger({"model_merging_enabled": True})
        merger.register_model("coding", lambda q: "code response", "coding")
        assert "coding" in merger.models

    def test_merge_for_task(self):
        merger = ModelMerger({"model_merging_enabled": True})
        merger.register_model("coding", lambda q: "code response", "coding")
        merger.register_model("reasoning", lambda q: "reasoning response", "reasoning")

        callback = merger.merge_for_task("coding", "write a function")
        assert callback is not None

        result = callback("write a function")
        assert result is not None

    def test_disabled_returns_none(self):
        merger = ModelMerger({"model_merging_enabled": False})
        merger.register_model("coding", lambda q: "code", "coding")
        callback = merger.merge_for_task("coding", "test")
        assert callback is None

    def test_no_matching_models(self):
        merger = ModelMerger({"model_merging_enabled": True})
        callback = merger.merge_for_task("unknown_type", "test")
        assert callback is None

    def test_unregister_model(self):
        merger = ModelMerger({"model_merging_enabled": True})
        merger.register_model("coding", lambda q: "code", "coding")
        merger.unregister_model("coding")
        assert "coding" not in merger.models

    def test_status(self):
        merger = ModelMerger({"model_merging_enabled": True, "merge_method": "simple_average"})
        status = merger.get_status()
        assert status["enabled"] is True
        assert status["merge_method"] == "simple_average"
