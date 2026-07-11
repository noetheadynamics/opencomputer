import logging
import time
from dataclasses import dataclass, field
from typing import Any, Callable, Optional

logger = logging.getLogger(__name__)


@dataclass
class ToolCall:
    name: str
    args: dict[str, Any]
    confidence: float = 0.0


@dataclass
class Thought:
    reasoning: str
    plan: str
    tool_calls: list[ToolCall] = field(default_factory=list)
    confidence: float = 0.0
    done: bool = False


@dataclass
class Observation:
    tool_call: ToolCall
    result: Any
    success: bool
    error: str | None = None
    duration: float = 0.0


@dataclass
class ReActStep:
    iteration: int
    thought: Thought
    observations: list[Observation]
    duration: float
    total_tokens: int = 0


class ReActLoop:
    def __init__(self, max_iterations: int = 10, max_time: float = 300.0):
        self.max_iterations = max_iterations
        self.max_time = max_time
        self.steps: list[ReActStep] = []
        self._start_time: float = 0.0
        self._total_tokens: int = 0
        self._compact_context = None
        self._messages: list[dict] = []

    def set_compact_context(self, compact_context, messages: list[dict]):
        """Set the DCP compact context for auto-compact reminders."""
        self._compact_context = compact_context
        self._messages = messages

    def _inject_auto_compact_reminder(self):
        """Before each model call, check usage and inject reminder if needed."""
        if not self._compact_context or not self._messages:
            return
        from ..core.compact_context import get_auto_compact_reminder
        usage = self._compact_context.get_usage(self._messages)
        if usage["should_auto_compact"]:
            reminder = get_auto_compact_reminder(usage)
            self._messages.append({"role": "system", "content": reminder})

    def run(
        self,
        query: str,
        agent_fn: Callable[[str, list[ReActStep]], Thought],
        tool_executor: Callable[[ToolCall], Observation],
    ) -> dict[str, Any]:
        """Execute ReAct loop.

        agent_fn(query, history) -> Thought (with tool_calls or done=True)
        tool_executor(tool_call) -> Observation
        """
        self._start_time = time.time()
        self.steps = []
        self._compact_context = None
        self._messages = []

        for i in range(self.max_iterations):
            elapsed = time.time() - self._start_time
            if elapsed > self.max_time:
                logger.warning(
                    f"ReAct loop time limit reached ({self.max_time}s)"
                )
                break

            # Inject auto-compact reminder if usage is high
            self._inject_auto_compact_reminder()

            try:
                thought = agent_fn(query, self.steps)
            except Exception as e:
                logger.error(
                    f"Agent function failed at iteration {i}: {e}"
                )
                return self._build_result(
                    query, "error", f"Agent error: {e}"
                )

            if thought.done:
                return self._build_result(
                    query, "success", thought.reasoning
                )

            observations = []
            for tc in thought.tool_calls:
                try:
                    obs = tool_executor(tc)
                except Exception as e:
                    obs = Observation(
                        tool_call=tc,
                        result=None,
                        success=False,
                        error=str(e),
                    )
                observations.append(obs)

            step = ReActStep(
                iteration=i,
                thought=thought,
                observations=observations,
                duration=time.time() - self._start_time,
            )
            self.steps.append(step)

        last_thought = (
            self.steps[-1].thought
            if self.steps
            else Thought(
                reasoning="No steps completed", plan="", done=False
            )
        )
        return self._build_result(
            query, "max_iterations", last_thought.reasoning
        )

    def _build_result(
        self, query: str, status: str, response: str
    ) -> dict[str, Any]:
        return {
            "query": query,
            "status": status,
            "response": response,
            "iterations": len(self.steps),
            "total_time": (
                time.time() - self._start_time
                if self._start_time
                else 0.0
            ),
            "steps": [
                {
                    "iteration": s.iteration,
                    "thought": s.thought.reasoning,
                    "plan": s.thought.plan,
                    "observations": [
                        {
                            "tool": o.tool_call.name,
                            "success": o.success,
                            "error": o.error,
                        }
                        for o in s.observations
                    ],
                }
                for s in self.steps
            ],
        }

    def reset(self):
        self.steps = []
        self._start_time = 0.0
        self._total_tokens = 0
