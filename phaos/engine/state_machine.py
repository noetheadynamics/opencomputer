import enum
import time
import logging
from dataclasses import dataclass, field

logger = logging.getLogger(__name__)


class TaskState(enum.Enum):
    PENDING = "PENDING"
    CLASSIFYING = "CLASSIFYING"
    GATING = "GATING"
    REASONING = "REASONING"
    TOOL_CALLING = "TOOL_CALLING"
    OBSERVING = "OBSERVING"
    AMPLIFYING = "AMPLIFYING"
    VALIDATING = "VALIDATING"
    COMPLETED = "COMPLETED"
    FAILED = "FAILED"
    ABSTAINED = "ABSTAINED"
    RECOVERING = "RECOVERING"


VALID_TRANSITIONS: dict[TaskState, set[TaskState]] = {
    TaskState.PENDING: {TaskState.CLASSIFYING, TaskState.FAILED},
    TaskState.CLASSIFYING: {TaskState.GATING, TaskState.REASONING, TaskState.FAILED},
    TaskState.GATING: {TaskState.REASONING, TaskState.ABSTAINED, TaskState.FAILED},
    TaskState.REASONING: {TaskState.TOOL_CALLING, TaskState.AMPLIFYING, TaskState.VALIDATING, TaskState.COMPLETED, TaskState.FAILED},
    TaskState.TOOL_CALLING: {TaskState.OBSERVING, TaskState.REASONING, TaskState.FAILED},
    TaskState.OBSERVING: {TaskState.REASONING, TaskState.TOOL_CALLING, TaskState.FAILED},
    TaskState.AMPLIFYING: {TaskState.VALIDATING, TaskState.COMPLETED, TaskState.FAILED},
    TaskState.VALIDATING: {TaskState.COMPLETED, TaskState.REASONING, TaskState.FAILED},
    TaskState.RECOVERING: {TaskState.CLASSIFYING, TaskState.TOOL_CALLING, TaskState.FAILED},
    TaskState.COMPLETED: set(),
    TaskState.FAILED: {TaskState.RECOVERING},
    TaskState.ABSTAINED: set(),
}


@dataclass
class TransitionRecord:
    state: str
    timestamp: float
    duration: float


class StateManager:
    def __init__(self, max_recoveries: int = 3):
        self._state: TaskState = TaskState.PENDING
        self._history: list[TransitionRecord] = []
        self._max_recoveries = max_recoveries
        self._recovery_count: int = 0
        self._state_entered_at: float = time.time()

        self._history.append(TransitionRecord(
            state=self._state.value,
            timestamp=self._state_entered_at,
            duration=0.0,
        ))

    def transition(self, new_state: TaskState) -> None:
        if not self.can_transition(new_state):
            raise ValueError(
                f"Invalid transition: {self._state.value} → {new_state.value}"
            )

        if new_state == TaskState.RECOVERING:
            self._recovery_count += 1
            if self._recovery_count > self._max_recoveries:
                raise ValueError(
                    f"Max recoveries ({self._max_recoveries}) exceeded"
                )

        if new_state == TaskState.PENDING:
            self._recovery_count = 0

        self._record_transition(new_state)
        self._state = new_state
        self._state_entered_at = time.time()

    def get_state(self) -> TaskState:
        return self._state

    def get_history(self) -> list[dict]:
        return [
            {"state": r.state, "timestamp": r.timestamp, "duration": r.duration}
            for r in self._history
        ]

    def can_transition(self, new_state: TaskState) -> bool:
        allowed = VALID_TRANSITIONS.get(self._state, set())
        return new_state in allowed

    def reset(self) -> None:
        self._state = TaskState.PENDING
        self._recovery_count = 0
        self._state_entered_at = time.time()
        self._history = [
            TransitionRecord(
                state=TaskState.PENDING.value,
                timestamp=self._state_entered_at,
                duration=0.0,
            )
        ]

    def elapsed(self) -> float:
        if not self._history:
            return 0.0
        return time.time() - self._history[0].timestamp

    def _record_transition(self, new_state: TaskState) -> None:
        now = time.time()
        duration = now - self._state_entered_at
        self._history.append(
            TransitionRecord(
                state=new_state.value,
                timestamp=now,
                duration=duration,
            )
        )
        logger.debug(
            "Transition %s → %s (duration=%.3fs)",
            self._state.value,
            new_state.value,
            duration,
        )
