"""PHAOS core integration module — adapters for external services."""

from .alethea_adapter import AletheaAdapter
from .vision_adapter import VisionAdapter
from .model_merging import ModelMerger

__all__ = [
    "AletheaAdapter",
    "VisionAdapter",
    "ModelMerger",
]
