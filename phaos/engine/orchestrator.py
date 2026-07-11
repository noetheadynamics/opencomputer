"""PHAOS Layered Orchestrator — the sole decision-maker.

Manages the full pipeline: classify → gate → reason → tool_call → observe → amplify → validate → respond.
Alethea Hard Gate is NEVER bypassed for Cat 3.
CrossSessionState is the single source of truth.
"""

import logging
import re
import time
from dataclasses import dataclass, field
from typing import Any, Callable, Optional

from .react_loop import ReActLoop, Thought, ToolCall, Observation
from .state_machine import TaskState, StateManager
from .tool_router import SandboxedExecutor, ToolResult
from .error_recovery import ErrorRecovery, RetryPolicy
from .av2_adapter import AV2Adapter
from .alethea_adapter import AletheaAdapter

logger = logging.getLogger(__name__)


@dataclass
class TaskContext:
    """Full context for a single task execution."""
    task_id: str
    prompt: str
    model: str = "local-default"
    config: dict[str, Any] = field(default_factory=dict)
    metadata: dict[str, Any] = field(default_factory=dict)


@dataclass
class TaskResult:
    """Result of a completed task."""
    task_id: str
    status: str  # completed, failed, abstained
    response: str
    category: int | None = None
    iterations: int = 0
    amplifications_applied: list[str] = field(default_factory=list)
    tool_calls_made: int = 0
    total_time: float = 0.0
    metadata: dict[str, Any] = field(default_factory=dict)
    error: str | None = None


class LayeredOrchestrator:
    """The sole decision-maker for PHAOS task execution.

    Manages the full pipeline through Alethea classification/gating/reasoning,
    ReAct tool loops, AV2 amplification, and validation.
    """

    def __init__(
        self,
        alethea: AletheaAdapter | None = None,
        av2: AV2Adapter | None = None,
        executor: SandboxedExecutor | None = None,
        config: dict[str, Any] | None = None,
    ):
        self.config = config or {}
        self.alethea = alethea or AletheaAdapter(self.config.get("alethea", {}))
        self.av2 = av2 or AV2Adapter(self.config.get("av2", {}))
        self.executor = executor or SandboxedExecutor(
            workspace_root=self.config.get("workspace_root", ".")
        )
        self.error_recovery = ErrorRecovery(
            RetryPolicy(
                max_retries=self.config.get("max_retries", 3),
                base_delay=self.config.get("retry_base_delay", 1.0),
            )
        )
        self._active_tasks: dict[str, StateManager] = {}

    def execute(self, task: TaskContext) -> TaskResult:
        """Execute a task through the full pipeline.

        This is the ONLY entry point for task execution.
        The orchestrator makes ALL decisions — no external component bypasses it.
        """
        state = StateManager(max_recoveries=self.config.get("max_recoveries", 3))
        self._active_tasks[task.task_id] = state
        start_time = time.time()

        try:
            result = self._run_pipeline(task, state)
            result.total_time = time.time() - start_time
            return result
        except Exception as e:
            logger.error(f"Pipeline failed for task {task.task_id}: {e}")
            state.transition(TaskState.FAILED)
            return TaskResult(
                task_id=task.task_id,
                status="failed",
                response=f"Task failed: {e}",
                total_time=time.time() - start_time,
                error=str(e),
            )
        finally:
            self._active_tasks.pop(task.task_id, None)

    def _run_pipeline(self, task: TaskContext, state: StateManager) -> TaskResult:
        """Core pipeline execution."""

        # ── Step 1: Classify ──────────────────────────────────────
        state.transition(TaskState.CLASSIFYING)
        category = self.alethea.classify(task.prompt)
        logger.info(f"Task {task.task_id}: classified as Cat {category}")

        # ── Step 2: Gate (Cat 3 ONLY — never bypassed) ───────────
        gate_result: dict[str, Any] = {"category": category, "context": None, "abstained": False, "abstention_message": ""}

        if category == 3:
            state.transition(TaskState.GATING)
            gate_result = self.alethea.run_gate(task.prompt, category)

            if gate_result["abstained"]:
                state.transition(TaskState.ABSTAINED)
                logger.info(f"Task {task.task_id}: Cat 3 gate abstained")
                return TaskResult(
                    task_id=task.task_id,
                    status="abstained",
                    response=gate_result["abstention_message"],
                    category=category,
                    metadata={"gate_abstained": True},
                )
        else:
            # Cat 1/2: skip gate per Alethea spec
            state.transition(TaskState.REASONING)

        # ── Step 3: ReAct loop (reason + tool calls) ──────────────
        react_loop = ReActLoop(
            max_iterations=self.config.get("max_react_iterations", 10),
            max_time=self.config.get("max_react_time", 300.0),
        )

        def agent_fn(query: str, history: list) -> Thought:
            """Agent function for ReAct loop — decides next action."""
            return self._agent_step(query, history, task, category, gate_result)

        def tool_executor(tool_call: ToolCall) -> Observation:
            """Execute a tool call through the sandboxed executor."""
            state.transition(TaskState.TOOL_CALLING)
            start = time.time()
            try:
                result = self.executor.execute_tool_call(tool_call)
                obs = Observation(
                    tool_call=tool_call,
                    result=result,
                    success=result.get("success", False) if isinstance(result, dict) else True,
                    error=result.get("error") if isinstance(result, dict) else None,
                    duration=time.time() - start,
                )
            except Exception as e:
                obs = Observation(
                    tool_call=tool_call,
                    result=None,
                    success=False,
                    error=str(e),
                    duration=time.time() - start,
                )
            state.transition(TaskState.OBSERVING)
            return obs

        react_result = react_loop.run(task.prompt, agent_fn, tool_executor)
        base_response = react_result.get("response", "")

        # ── Step 4: Amplify (AV2) ────────────────────────────────
        state.transition(TaskState.AMPLIFYING)
        amplifications: list[str] = []

        if self.av2.is_available:
            try:
                query_type = {1: "semantic", 2: "reasoning", 3: "factual"}.get(category, "factual")
                amp_result = self.av2.amplify_response(
                    task.prompt, base_response,
                    self._make_model_callback(task),
                    query_type=query_type,
                )
                if amp_result.get("amplifications_applied"):
                    base_response = amp_result["response"]
                    amplifications = amp_result["amplifications_applied"]
            except Exception as e:
                logger.warning(f"AV2 amplification failed: {e}")

        # ── Step 5: Validate (Cat 3 only) ────────────────────────
        final_response = base_response

        if category == 3:
            state.transition(TaskState.VALIDATING)
            try:
                validation = self.alethea.validate(base_response, task.prompt, context=gate_result.get("context"))
                if not validation.get("is_valid", True):
                    final_response = validation.get("validated_response", base_response)
                    logger.info(f"Task {task.task_id}: validation stripped ungrounded claims")
                else:
                    final_response = validation.get("validated_response", base_response)
            except Exception as e:
                logger.warning(f"Validation failed: {e}")

        # ── Step 6: Store in TruthVault (Cat 3) ──────────────────
        if category == 3 and self.av2.is_available:
            try:
                self.av2.store_in_truth_vault(task.prompt, final_response)
            except Exception:
                pass

        state.transition(TaskState.COMPLETED)
        return TaskResult(
            task_id=task.task_id,
            status="completed",
            response=final_response,
            category=category,
            iterations=react_result.get("iterations", 0),
            amplifications_applied=amplifications,
            tool_calls_made=sum(len(s.get("observations", [])) for s in react_result.get("steps", [])),
            metadata={
                "react_status": react_result.get("status"),
                "category": category,
                "gate_abstained": False,
            },
        )

    def _agent_step(
        self,
        query: str,
        history: list,
        task: TaskContext,
        category: int,
        gate_result: dict,
    ) -> Thought:
        """Single agent step in the ReAct loop.

        Decides: think more, call a tool, or finish.
        """
        iteration = len(history)
        max_iterations = self.config.get("max_react_iterations", 10)

        # If we've done enough iterations, synthesize and finish
        if iteration >= max_iterations - 1:
            return Thought(
                reasoning=f"Completed {iteration} iterations. Synthesizing final response.",
                plan="finish",
                tool_calls=[],
                confidence=0.7,
                done=True,
            )

        # Context from gate for Cat 3
        context = gate_result.get("context", "") if gate_result else ""

        # Determine what tool to call based on the query
        tool_calls = self._select_tools(query, task, category, context, iteration)

        if not tool_calls:
            # No tools needed — we can reason and finish
            return Thought(
                reasoning=f"Query can be answered directly. Category {category}.",
                plan="direct_answer",
                tool_calls=[ToolCall(name="done", args={"response": self._direct_answer(query, context)})],
                confidence=0.8,
                done=False,  # let the tool executor handle the "done" signal
            )

        return Thought(
            reasoning=f"Need to use tools to answer: {[tc.name for tc in tool_calls]}",
            plan="tool_use",
            tool_calls=tool_calls,
            confidence=0.6,
            done=False,
        )

    def _select_tools(
        self,
        query: str,
        task: TaskContext,
        category: int,
        context: str,
        iteration: int,
    ) -> list[ToolCall]:
        """Select appropriate tools for the current step."""
        tools: list[ToolCall] = []
        query_lower = query.lower()

        # File operations
        if any(kw in query_lower for kw in ["read file", "open file", "show file", "cat "]):
            path = self._extract_path(query)
            if path:
                tools.append(ToolCall(name="file_read", args={"path": path}))

        # Terminal commands
        if any(kw in query_lower for kw in ["run", "execute", "command", "terminal", "shell"]):
            cmd = self._extract_command(query)
            if cmd:
                tools.append(ToolCall(name="terminal", args={"command": cmd}))

        # Git operations
        if any(kw in query_lower for kw in ["git", "commit", "branch", "push", "pull"]):
            git_cmd = self._extract_git_command(query)
            if git_cmd:
                tools.append(ToolCall(name="git", args={"command": git_cmd}))

        # File write
        if any(kw in query_lower for kw in ["write file", "create file", "save to"]):
            path = self._extract_path(query)
            if path:
                tools.append(ToolCall(name="file_write", args={"path": path, "content": ""}))

        return tools

    def _direct_answer(self, query: str, context: str) -> str:
        """Generate a direct answer without tools."""
        if context:
            return f"Based on the available context:\n\n{context}\n\nQuery: {query}"
        return f"Query received: {query}. Processing without additional tools."

    def _extract_path(self, query: str) -> str | None:
        """Extract a file path from a query."""
        patterns = [
            r'(?:read|open|show|cat)\s+[`"\']?([^\s`"\']+)[`"\']?',
            r'(?:write|create|save)\s+(?:to\s+)?[`"\']?([^\s`"\']+)[`"\']?',
        ]
        for pat in patterns:
            m = re.search(pat, query, re.IGNORECASE)
            if m:
                return m.group(1)
        return None

    def _extract_command(self, query: str) -> str | None:
        """Extract a terminal command from a query."""
        m = re.search(r'(?:run|execute|command|terminal)\s+[`"\']?(.+?)[`"\']?$', query, re.IGNORECASE)
        if m:
            return m.group(1).strip()
        return None

    def _extract_git_command(self, query: str) -> str | None:
        """Extract a git subcommand from a query."""
        m = re.search(r'git\s+(\w+(?:\s+[^\s].*)?)', query, re.IGNORECASE)
        if m:
            return m.group(1).strip()
        return None

    def _make_model_callback(self, task: TaskContext) -> Callable:
        """Create a model callback for AV2 amplification."""
        def callback(query: str, temperature: float = 0.3) -> str:
            # Use Alethea reasoning engine as the model callback
            result = self.alethea.reason(query)
            return result.get("response", "")
        return callback

    def get_status(self, task_id: str | None = None) -> dict[str, Any]:
        """Get orchestrator or specific task status."""
        if task_id:
            state = self._active_tasks.get(task_id)
            if state:
                return {"task_id": task_id, "state": state.get_state().value, "history": state.get_history()}
            return {"task_id": task_id, "state": "not_found"}
        return {
            "active_tasks": len(self._active_tasks),
            "alethea": self.alethea.get_status(),
            "av2": self.av2.get_status(),
            "error_recovery": self.error_recovery.get_health(),
        }
