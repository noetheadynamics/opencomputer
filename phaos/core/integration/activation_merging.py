"""Activation-Informed Merging (AIM): Merge models based on activation patterns."""

from __future__ import annotations

import hashlib
import json
import logging
import math
from typing import Any, Callable, Dict, List, Optional

logger = logging.getLogger(__name__)


class ActivationInformedMerging:
    """Merge models by analyzing activation patterns during inference.

    Models that produce higher-activation (more confident/varied) outputs
    for a given task receive more weight during merging.
    """

    def __init__(self):
        self._activation_cache: Dict[str, Dict[str, float]] = {}

    def compute_activations(
        self,
        model_callback: Callable[[str], Any],
        sample_inputs: List[str],
    ) -> Dict[str, float]:
        """Compute activation scores for a model on sample inputs.

        Activation score is based on:
        - Output length variance (more varied = more activated)
        - Unique output ratio (more unique = more activated)
        - Response completeness (longer = more activated)
        """
        cache_key = hashlib.sha256(
            json.dumps([s for s in sample_inputs[:5]]).encode()
        ).hexdigest()

        if cache_key in self._activation_cache:
            return self._activation_cache[cache_key]

        scores: Dict[str, float] = {}
        try:
            outputs = []
            for inp in sample_inputs[:10]:
                out = model_callback(inp)
                if out is not None:
                    outputs.append(str(out))

            if not outputs:
                scores["default"] = 0.5
            else:
                unique_ratio = len(set(outputs)) / max(len(outputs), 1)
                lengths = [len(o) for o in outputs]
                avg_len = sum(lengths) / max(len(lengths), 1)
                len_var = sum((l - avg_len) ** 2 for l in lengths) / max(len(lengths), 1)
                normalized_var = min(math.sqrt(len_var) / 100, 1.0)
                completeness = min(avg_len / 500, 1.0)
                activation = 0.35 * unique_ratio + 0.35 * normalized_var + 0.3 * completeness
                scores["default"] = round(activation, 4)

        except Exception as e:
            logger.warning(f"Activation computation failed: {e}")
            scores["default"] = 0.5

        self._activation_cache[cache_key] = scores
        return scores

    def merge(
        self,
        models: Dict[str, Callable[[str], Any]],
        activation_mask: Optional[Dict[str, Dict[str, float]]] = None,
        query: str = "",
    ) -> Callable[[str], Any]:
        """Merge models using activation-informed weighting.

        Models with higher activation scores get more influence on the
        final merged output.
        """
        if not models:
            return lambda q: None

        model_weights = self._compute_activation_weights(models, activation_mask)

        def merged_callback(q: str) -> Optional[str]:
            responses: List[tuple] = []
            for name, model in models.items():
                try:
                    response = model(q)
                    if response is not None:
                        responses.append((name, str(response)))
                except Exception as e:
                    logger.warning(f"Model '{name}' failed during AIM merge: {e}")
                    continue

            if not responses:
                return None

            if len(responses) == 1:
                return responses[0][1]

            return self._activation_select(responses, model_weights)

        return merged_callback

    def _compute_activation_weights(
        self,
        models: Dict[str, Callable],
        activation_mask: Optional[Dict[str, Dict[str, float]]],
    ) -> Dict[str, float]:
        """Compute weights from activation patterns."""
        if activation_mask:
            weights = {}
            for name in models:
                if name in activation_mask and "default" in activation_mask[name]:
                    weights[name] = activation_mask[name]["default"]
                else:
                    weights[name] = 0.5

            total = sum(weights.values())
            if total > 0:
                return {k: v / total for k, v in weights.items()}

        n = len(models)
        if n == 0:
            return {}
        equal_weight = 1.0 / n
        return {name: equal_weight for name in models}

    def _activation_select(
        self,
        responses: List[tuple],
        weights: Dict[str, float],
    ) -> str:
        """Select response based on activation-weighted scoring."""
        scored = []
        for name, response in responses:
            weight = weights.get(name, 0.5)
            length_bonus = min(len(response) / 200, 1.0)
            score = weight * 0.7 + length_bonus * 0.3
            scored.append((score, response))

        scored.sort(key=lambda x: x[0], reverse=True)
        return scored[0][1]


def get_activation_merging() -> ActivationInformedMerging:
    """Get singleton ActivationInformedMerging instance."""
    if not hasattr(get_activation_merging, "_instance"):
        get_activation_merging._instance = ActivationInformedMerging()
    return get_activation_merging._instance
