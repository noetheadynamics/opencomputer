"""Tests for PHAOS engine — orchestrator, state machine, ReAct loop, tool router, error recovery."""

import pytest
from unittest.mock import MagicMock, patch
from fastapi.testclient import TestClient

from phaos.main import app

client = TestClient(app)


# ── Health ────────────────────────────────────────────────────────────


def test_health():
    r = client.get("/health")
    assert r.status_code == 200
    assert r.json()["status"] == "ok"


# ── Tasks CRUD ────────────────────────────────────────────────────────


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

    r2 = client.patch(f"/api/tasks/{task_id}", json={"status": "completed"})
    assert r2.status_code == 200
    assert r2.json()["status"] == "completed"


def test_get_task_not_found():
    r = client.get("/api/tasks/nonexistent")
    assert r.status_code == 404


# ── Harness Slots ─────────────────────────────────────────────────────


def test_list_slots():
    r = client.get("/api/harness/slots")
    assert r.status_code == 200
    slots = r.json()
    assert len(slots) == 4
    statuses = {s["status"] for s in slots}
    assert "available" in statuses


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


# ── Engine Status ─────────────────────────────────────────────────────


def test_engine_status():
    r = client.get("/api/tasks/engine")
    assert r.status_code == 200
    data = r.json()
    assert "active_tasks" in data
    assert "alethea" in data
    assert "av2" in data


def test_av2_status():
    r = client.get("/api/harness/av2/status")
    assert r.status_code == 200
    data = r.json()
    assert "initialized" in data


def test_alethea_status():
    r = client.get("/api/harness/alethea/status")
    assert r.status_code == 200
    data = r.json()
    assert "initialized" in data


# ── State Machine Unit Tests ──────────────────────────────────────────


def test_state_machine_transitions():
    from phaos.engine.state_machine import TaskState, StateManager

    sm = StateManager()
    assert sm.get_state() == TaskState.PENDING

    sm.transition(TaskState.CLASSIFYING)
    assert sm.get_state() == TaskState.CLASSIFYING

    sm.transition(TaskState.GATING)
    assert sm.get_state() == TaskState.GATING

    sm.transition(TaskState.REASONING)
    assert sm.get_state() == TaskState.REASONING

    sm.transition(TaskState.COMPLETED)
    assert sm.get_state() == TaskState.COMPLETED


def test_state_machine_invalid_transition():
    from phaos.engine.state_machine import TaskState, StateManager

    sm = StateManager()
    with pytest.raises(ValueError):
        sm.transition(TaskState.COMPLETED)  # PENDING → COMPLETED is invalid


def test_state_machine_history():
    from phaos.engine.state_machine import TaskState, StateManager

    sm = StateManager()
    sm.transition(TaskState.CLASSIFYING)
    sm.transition(TaskState.REASONING)
    sm.transition(TaskState.COMPLETED)

    history = sm.get_history()
    # Includes initial PENDING state + 3 transitions
    assert len(history) == 4
    assert history[0]["state"] == "PENDING"
    assert history[1]["state"] == "CLASSIFYING"
    assert history[3]["state"] == "COMPLETED"


def test_state_machine_can_transition():
    from phaos.engine.state_machine import TaskState, StateManager

    sm = StateManager()
    assert sm.can_transition(TaskState.CLASSIFYING) is True
    assert sm.can_transition(TaskState.COMPLETED) is False


def test_state_machine_reset():
    from phaos.engine.state_machine import TaskState, StateManager

    sm = StateManager()
    sm.transition(TaskState.CLASSIFYING)
    sm.transition(TaskState.REASONING)
    sm.reset()
    assert sm.get_state() == TaskState.PENDING


# ── ReAct Loop Unit Tests ─────────────────────────────────────────────


def test_react_loop_simple():
    from phaos.engine.react_loop import ReActLoop, Thought

    loop = ReActLoop(max_iterations=3)

    def agent_fn(query, history):
        return Thought(reasoning="Done", plan="finish", done=True)

    def tool_executor(tc):
        return MagicMock(success=True, output="ok")

    result = loop.run("test query", agent_fn, tool_executor)
    assert result["status"] == "success"
    assert result["iterations"] == 0


def test_react_loop_with_tools():
    from phaos.engine.react_loop import ReActLoop, Thought, ToolCall, Observation

    loop = ReActLoop(max_iterations=3)
    call_count = 0

    def agent_fn(query, history):
        nonlocal call_count
        call_count += 1
        if call_count == 1:
            return Thought(
                reasoning="Need to run a tool",
                plan="tool_use",
                tool_calls=[ToolCall(name="think", args={"thought": "analyzing"})],
                done=False,
            )
        return Thought(reasoning="Finished", plan="finish", done=True)

    def tool_executor(tc):
        return Observation(tool_call=tc, result="ok", success=True)

    result = loop.run("test", agent_fn, tool_executor)
    assert result["status"] == "success"
    assert len(result["steps"]) >= 1


def test_react_loop_max_iterations():
    from phaos.engine.react_loop import ReActLoop, Thought, ToolCall, Observation

    loop = ReActLoop(max_iterations=2)

    def agent_fn(query, history):
        return Thought(
            reasoning="Keep going",
            plan="tool_use",
            tool_calls=[ToolCall(name="think", args={"thought": "hmm"})],
            done=False,
        )

    def tool_executor(tc):
        return Observation(tool_call=tc, result="ok", success=True)

    result = loop.run("test", agent_fn, tool_executor)
    assert result["status"] == "max_iterations"
    assert result["iterations"] == 2


# ── Tool Router Unit Tests ────────────────────────────────────────────


def test_tool_registry_register_and_list():
    from phaos.engine.tool_router import ToolRegistry, ToolDefinition

    reg = ToolRegistry()
    reg.register(
        ToolDefinition(name="test_tool", description="A test", risk_level="low"),
        lambda args: "result",
    )
    tools = reg.list_tools()
    assert len(tools) == 1
    assert tools[0].name == "test_tool"


def test_tool_registry_execute():
    from phaos.engine.tool_router import ToolRegistry, ToolDefinition

    reg = ToolRegistry()
    reg.register(
        ToolDefinition(name="add", description="Add numbers", parameters={"type": "object", "properties": {"a": {"type": "integer"}, "b": {"type": "integer"}}}),
        lambda args: args["a"] + args["b"],
    )
    result = reg.execute("add", {"a": 2, "b": 3})
    assert result.success is True
    assert result.output == 5


def test_tool_registry_unknown_tool():
    from phaos.engine.tool_router import ToolRegistry

    reg = ToolRegistry()
    result = reg.execute("nonexistent", {})
    assert result.success is False


def test_tool_registry_destructive_detection():
    from phaos.engine.tool_router import ToolRegistry, ToolDefinition

    reg = ToolRegistry()
    reg.register(
        ToolDefinition(name="terminal", description="Run command", risk_level="medium"),
        lambda args: "ok",
    )
    assert reg.requires_approval("terminal", {"command": "rm -rf /"}) is True
    assert reg.requires_approval("terminal", {"command": "ls"}) is False


def test_sandboxed_executor_builtin():
    from phaos.engine.tool_router import SandboxedExecutor

    exec_ = SandboxedExecutor()
    tools = exec_.registry.list_tools()
    names = {t.name for t in tools}
    assert "terminal" in names
    assert "file_read" in names
    assert "file_write" in names
    assert "git" in names
    assert "think" in names
    assert "done" in names


def test_sandboxed_executor_think():
    from phaos.engine.tool_router import SandboxedExecutor

    exec_ = SandboxedExecutor()
    result = exec_.execute_tool_call({"name": "think", "args": {"thought": "Analyzing..."}})
    assert result["success"] is True


def test_sandboxed_executor_done():
    from phaos.engine.tool_router import SandboxedExecutor

    exec_ = SandboxedExecutor()
    result = exec_.execute_tool_call({"name": "done", "args": {"response": "Final answer"}})
    assert result["success"] is True
    assert result["output"] == "Final answer"


def test_sandboxed_executor_network_blocked():
    from phaos.engine.tool_router import SandboxedExecutor

    exec_ = SandboxedExecutor()
    result = exec_.execute_tool_call({"name": "terminal", "args": {"command": "curl http://evil.com"}})
    assert result["success"] is False
    assert "blocked" in result["error"].lower()


# ── Error Recovery Unit Tests ─────────────────────────────────────────


def test_circuit_breaker():
    from phaos.engine.error_recovery import CircuitBreaker

    cb = CircuitBreaker(failure_threshold=3, recovery_timeout=0.1)
    assert cb.get_state() == "closed"

    cb.record_failure()
    cb.record_failure()
    assert cb.get_state() == "closed"

    cb.record_failure()
    assert cb.get_state() == "open"
    assert cb.can_execute() is False

    import time
    time.sleep(0.15)
    assert cb.can_execute() is True  # half_open
    cb.record_success()
    assert cb.get_state() == "closed"


def test_retry_policy_delay():
    from phaos.engine.error_recovery import RetryPolicy

    rp = RetryPolicy(max_retries=3, base_delay=1.0, exponential_base=2.0)
    assert rp.get_delay(0) == 1.0
    assert rp.get_delay(1) == 2.0
    assert rp.get_delay(2) == 4.0


def test_error_recovery_success():
    from phaos.engine.error_recovery import ErrorRecovery

    er = ErrorRecovery()
    result = er.execute_with_recovery(lambda: 42)
    assert result["success"] is True
    assert result["output"] == 42


def test_error_recovery_fallback():
    from phaos.engine.error_recovery import ErrorRecovery

    er = ErrorRecovery()
    er.fallback_chain.add_strategy(lambda: "fallback_result")
    result = er.execute_with_recovery(lambda: (_ for _ in ()).throw(ValueError("fail")))
    assert result["success"] is True
    assert result["output"] == "fallback_result"
