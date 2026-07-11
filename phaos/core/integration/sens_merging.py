"""Sens-Merging: Parameter sensitivity-aware model merging."""

from __future__ import annotations

import hashlib
import json
import logging
import math
from typing import Any, Callable, Dict, List, Optional

logger = logging.getLogger(__name__)


class SensMerging:
    """Merge models using parameter sensitivity analysis.

    Sensitivity scores indicate how important each model's parameters are
    for a given task. Higher sensitivity = more weight during merging.
    """

    def __init__(self):
        self._sensitivity_cache: Dict[str, Dict[str, float]] = {}

    def compute_sensitivity(
        self,
        model_callback: Callable[[str], Any],
        sample_inputs: List[str],
        layer_names: Optional[List[str]] = None,
    ) -> Dict[str, float]:
        """Compute sensitivity scores for a model on sample inputs.

        Uses output variance as a proxy for parameter sensitivity:
        - High variance across inputs = model is sensitive to input changes
        - Low variance = model outputs are stable (less sensitive)
        """
        cache_key = hashlib.sha256(
            json.dumps([s for s in sample_inputs[:5]]).encode()
        ).hexdigest()

        if cache_key in self._sensitivity_cache:
            return self._sensitivity_cache[cache_key]

        sensitivities: Dict[str, float] = {}
        try:
            outputs = []
            for inp in sample_inputs[:10]:
                out = model_callback(inp)
                if out is not None:
                    outputs.append(str(out))

            if not outputs:
                sensitivities["default"] = 1.0
            else:
                unique_ratio = len(set(outputs)) / max(len(outputs), 1)
                avg_len = sum(len(o) for o in outputs) / max(len(outputs), 1)
                len_variance = (
                    sum((len(o) - avg_len) ** 2 for o in outputs)
                    / max(len(outputs), 1)
                )
                normalized_var = min(math.sqrt(len_variance) / 100, 1.0)
                sensitivity = 0.4 * unique_ratio + 0.3 * normalized_var + 0.3
                sensitivities["default"] = round(sensitivity, 4)

        except Exception as e:
            logger.warning(f"Sensitivity computation failed: {e}")
            sensitivities["default"] = 1.0

        self._sensitivity_cache[cache_key] = sensitivities
        return sensitivities

    def merge(
        self,
        models: Dict[str, Callable[[str], Any]],
        weights: Optional[Dict[str, float]] = None,
        sensitivity: Optional[Dict[str, float]] = None,
        query: str = "",
    ) -> Callable[[str], Any]:
        """Merge models using sensitivity-weighted combination.

        Args:
            models: {name: callback} mapping
            weights: Optional manual weights (override sensitivity)
            sensitivity: Pre-computed sensitivity scores
            query: The query to merge responses for

        Returns:
            A callback that produces a merged response
        """
        if not models:
            return lambda q: None

        model_weights = self._compute_weights(models, weights, sensitivity)

        def merged_callback(q: str) -> Optional[str]:
            responses: List[tuple] = []
            for name, model in models.items():
                try:
                    response = model(q)
                    if response is not None:
                        responses.append((name, str(response)))
                except Exception as e:
                    logger.warning(f"Model '{name}' failed during sens-merge: {e}")
                    continue

            if not responses:
                return None

            if len(responses) == 1:
                return responses[0][1]

            return self._weighted_select(responses, model_weights)

        return merged_callback

    def _compute_weights(
        self,
        models: Dict[str, Callable],
        manual_weights: Optional[Dict[str, float]],
        sensitivity: Optional[Dict[str, float]],
    ) -> Dict[str, float]:
        """Compute merge weights from manual or sensitivity data."""
        if manual_weights:
            total = sum(manual_weights.values())
            if total > 0:
                return {k: v / total for k, v in manual_weights.items()}
            return {k: 1.0 / len(manual_weights) for k in manual_weights}

        if sensitivity:
            total = sum(sensitivity.values())
            if total > 0:
                return {k: v / total for k, v in sensitivity.items()}

        n = len(models)
        if n == 0:
            return {}
        equal_weight = 1.0 / n
        return {name: equal_weight for name in models}

    def _weighted_select(
        self,
        responses: List[tuple],
        weights: Dict[str, float],
    ) -> str:
        """Select response based on weighted scoring."""
        scored = []
        for name, response in responses:
            weight = weights.get(name, 1.0 / max(len(responses), 1))
            score = weight * len(response)
            scored.append((score, response))

        scored.sort(key=lambda x: x[0], reverse=True)
        return scored[0][1]


def get_sens_merging() -> SensMerging:
    """Get singleton SensMerging instance."""
    if not hasattr(get_sens_merging, "_instance"):
        get_sens_merging._instance = SensMerging()
    return get_sens_merging._instance
