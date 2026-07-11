import asyncio
import logging
import time
from dataclasses import dataclass, field
from typing import Any, Callable

logger = logging.getLogger(__name__)

@dataclass
class RetryPolicy:
    max_retries: int = 3
    base_delay: float = 1.0
    max_delay: float = 30.0
    exponential_base: float = 2.0
    
    def get_delay(self, attempt: int) -> float:
        delay = self.base_delay * (self.exponential_base ** attempt)
        return min(delay, self.max_delay)

@dataclass
class FallbackChain:
    strategies: list[Callable] = field(default_factory=list)
    _current_index: int = 0
    
    def add_strategy(self, strategy: Callable) -> None:
        self.strategies.append(strategy)
    
    def get_next(self) -> Callable | None:
        if self._current_index < len(self.strategies):
            strategy = self.strategies[self._current_index]
            self._current_index += 1
            return strategy
        return None
    
    def reset(self) -> None:
        self._current_index = 0

class CircuitBreaker:
    CLOSED = "closed"
    OPEN = "open"
    HALF_OPEN = "half_open"
    
    def __init__(self, failure_threshold: int = 5, recovery_timeout: float = 60.0):
        self.failure_threshold = failure_threshold
        self.recovery_timeout = recovery_timeout
        self._state = self.CLOSED
        self._failure_count = 0
        self._last_failure_time = 0.0
    
    def record_success(self) -> None:
        self._failure_count = 0
        if self._state == self.HALF_OPEN:
            self._state = self.CLOSED
            logger.info("Circuit breaker: HALF_OPEN → CLOSED")
    
    def record_failure(self) -> None:
        self._failure_count += 1
        self._last_failure_time = time.time()
        if self._failure_count >= self.failure_threshold:
            self._state = self.OPEN
            logger.warning(f"Circuit breaker: OPEN (failures={self._failure_count})")
    
    def can_execute(self) -> bool:
        if self._state == self.CLOSED:
            return True
        if self._state == self.OPEN:
            if time.time() - self._last_failure_time > self.recovery_timeout:
                self._state = self.HALF_OPEN
                logger.info("Circuit breaker: OPEN → HALF_OPEN")
                return True
            return False
        return True
    
    def get_state(self) -> str:
        return self._state

class ErrorRecovery:
    def __init__(self, retry_policy: RetryPolicy | None = None):
        self.retry_policy = retry_policy or RetryPolicy()
        self.circuit_breaker = CircuitBreaker()
        self.fallback_chain = FallbackChain()
        self._error_history: list[dict] = []
    
    def execute_with_recovery(self, fn: Callable, *args, tool_name: str = "unknown", **kwargs) -> dict[str, Any]:
        if not self.circuit_breaker.can_execute():
            logger.warning(f"Circuit breaker OPEN for {tool_name}, attempting fallback")
            return self._try_fallback(tool_name, args, kwargs)
        
        last_error = None
        for attempt in range(self.retry_policy.max_retries + 1):
            try:
                result = fn(*args, **kwargs)
                self.circuit_breaker.record_success()
                return {"success": True, "output": result, "attempts": attempt + 1}
            except Exception as e:
                last_error = e
                self._error_history.append({"tool": tool_name, "error": str(e), "attempt": attempt + 1, "timestamp": time.time()})
                logger.warning(f"Attempt {attempt + 1} failed for {tool_name}: {e}")
                if attempt < self.retry_policy.max_retries:
                    delay = self.retry_policy.get_delay(attempt)
                    try:
                        loop = asyncio.get_running_loop()
                        loop.run_until_complete(asyncio.sleep(delay))
                    except RuntimeError:
                        time.sleep(delay)
        
        self.circuit_breaker.record_failure()
        return self._try_fallback(tool_name, args, kwargs, last_error)
    
    def _try_fallback(self, tool_name: str, args: tuple, kwargs: dict, original_error: Exception | None = None) -> dict[str, Any]:
        strategy = self.fallback_chain.get_next()
        if strategy:
            try:
                result = strategy(*args, **kwargs)
                return {"success": True, "output": result, "fallback": True}
            except Exception as e:
                logger.error(f"Fallback strategy failed for {tool_name}: {e}")
        
        return {"success": False, "error": str(original_error) or "All recovery strategies exhausted", "tool": tool_name}
    
    def get_health(self) -> dict[str, Any]:
        return {"circuit_breaker": self.circuit_breaker.get_state(), "total_errors": len(self._error_history), "recent_errors": self._error_history[-5:]}
