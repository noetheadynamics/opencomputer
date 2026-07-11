"""Model Merging — inference-time model combination with advanced strategies."""

from __future__ import annotations

import logging
import time
from typing import Any, Callable, Dict, List, Optional

from .sens_merging import SensMerging
from .activation_merging import ActivationInformedMerging
from .merge_optimizer import MergeOptimizer, STRATEGIES

logger = logging.getLogger(__name__)

TASK_TO_MODELS = {
    "coding": ["coding", "reasoning"],
    "design": ["design", "reasoning"],
    "math": ["math", "reasoning"],
    "vision": ["vision", "reasoning"],
    "factual": ["factual", "reasoning"],
    "reasoning": ["reasoning"],
    "general": ["general"],
}


class ModelMerger:
    """Combines multiple specialized models at inference time.

    Supports three merge strategies:
    - simple_average: Take the first (highest priority) response
    - sens_merging: Weight by parameter sensitivity
    - activation_informed: Weight by activation patterns
    - dynamic: Auto-select best strategy per task type
    """

    def __init__(
        self,
        config: Optional[Dict] = None,
        optimizer: Optional[MergeOptimizer] = None,
    ):
        config = config or {}
        self.models: Dict[str, Dict] = {}
        self.merge_method = config.get("merge_method", "simple_average")
        self.enabled = config.get("model_merging_enabled", False)
        self.task_strategies: Dict[str, str] = config.get("task_strategies", {})
        self.sens_merging = SensMerging()
        self.activation_merging = ActivationInformedMerging()
        self.optimizer = optimizer

    def register_model(
        self,
        name: str,
        model_callback: Callable[[str], Any],
        specialization: str,
    ):
        self.models[name] = {
            "callback": model_callback,
            "specialization": specialization,
        }

    def unregister_model(self, name: str):
        self.models.pop(name, None)

    def get_strategy_for_task(self, task_type: str) -> str:
        """Get the merge strategy for a task type, with auto-optimization."""
        if self.optimizer:
            best = self.optimizer.get_best_strategy(task_type)
            if best and best["success_rate"] >= 0.6:
                return best["strategy"]
        return self.task_strategies.get(task_type, self.merge_method)

    def set_strategy_for_task(self, task_type: str, strategy: str):
        """Set the merge strategy for a task type."""
        if strategy not in STRATEGIES and strategy != "default":
            raise ValueError(f"Invalid strategy: {strategy}. Must be one of {STRATEGIES}")
        self.task_strategies[task_type] = strategy

    def merge_for_task(
        self, task_type: str, query: str
    ) -> Optional[Callable[[str], Optional[str]]]:
        """Select and merge the right models for the task type."""
        if not self.enabled or not self.models:
            return None

        model_names = TASK_TO_MODELS.get(task_type, ["general"])
        available_models: Dict[str, Callable] = {}
        for name in model_names:
            if name in self.models:
                available_models[name] = self.models[name]["callback"]

        for name, model in self.models.items():
            if model["specialization"] == task_type and name not in available_models:
                available_models[name] = model["callback"]

        if not available_models:
            return None

        strategy = self.get_strategy_for_task(task_type)

        if strategy == "dynamic":
            strategy = self._select_dynamic_strategy(task_type, available_models)

        if strategy == "sens_merging":
            merged = self.sens_merging.merge(available_models, query=query)
        elif strategy == "activation_informed":
            merged = self.activation_merging.merge(available_models, query=query)
        else:
            merged = self._simple_merge(available_models)

        def tracked_callback(q: str) -> Optional[str]:
            start = time.time()
            success = False
            result = None
            try:
                result = merged(q)
                success = result is not None
            except Exception as e:
                logger.warning(f"Merged callback failed: {e}")
            finally:
                elapsed = (time.time() - start) * 1000
                self._record_perf(task_type, strategy, success, elapsed, 0)
            return result

        return tracked_callback

    def _simple_merge(
        self, models: Dict[str, Callable]
    ) -> Callable[[str], Optional[str]]:
        def merged(q: str) -> Optional[str]:
            for name, model in models.items():
                try:
                    response = model(q)
                    if response is not None:
                        return str(response)
                except Exception:
                    continue
            return None
        return merged

    def _select_dynamic_strategy(
        self, task_type: str, models: Dict[str, Callable]
    ) -> str:
        """Auto-select best strategy based on optimizer data or heuristics."""
        if self.optimizer:
            best = self.optimizer.get_best_strategy(task_type)
            if best:
                return best["strategy"]

        n = len(models)
        if n <= 1:
            return "simple_average"
        if n == 2:
            return "activation_informed"
        return "sens_merging"

    def _record_perf(
        self,
        task_type: str,
        strategy: str,
        success: bool,
        latency_ms: float,
        tokens: int,
    ):
        if self.optimizer:
            try:
                self.optimizer.record_strategy_usage(
                    task_type=task_type,
                    strategy_name=strategy,
                    models=list(self.models.keys()),
                    success=success,
                    latency_ms=latency_ms,
                    tokens_used=tokens,
                )
            except Exception as e:
                logger.warning(f"Failed to record merge performance: {e}")

    def get_status(self) -> Dict[str, Any]:
        return {
            "enabled": self.enabled,
            "merge_method": self.merge_method,
            "registered_models": list(self.models.keys()),
            "total_models": len(self.models),
            "task_strategies": dict(self.task_strategies),
            "available_strategies": STRATEGIES,
        }


_merger_instance: Optional[ModelMerger] = None


def get_model_merger(
    config: Optional[Dict] = None,
    optimizer: Optional[MergeOptimizer] = None,
) -> ModelMerger:
    """Get or create ModelMerger singleton."""
    global _merger_instance
    if _merger_instance is None:
        _merger_instance = ModelMerger(config, optimizer)
    return _merger_instance


def reset_model_merger():
    """Reset singleton (for testing)."""
    global _merger_instance
    _merger_instance = None
