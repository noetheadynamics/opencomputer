"""Multi-harness management for PHAOS."""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Optional, Dict, Any
from enum import Enum


class HarnessStatus(str, Enum):
    ACTIVE = "active"
    INACTIVE = "inactive"
    ERROR = "error"


@dataclass
class HarnessDefinition:
    """Definition of a harness."""
    id: str
    name: str
    version: str
    description: str
    entry_point: str
    supports_file_tools: bool = True
    supports_terminal: bool = True
    supports_git: bool = True
    supports_cron: bool = True
    status: HarnessStatus = HarnessStatus.INACTIVE
    metadata: Dict[str, Any] = field(default_factory=dict)


class HarnessRegistry:
    """Registry for managing multiple harnesses."""

    def __init__(self):
        self._harnesses: Dict[str, HarnessDefinition] = {}
        self._active_harness_id: Optional[str] = None
        self._initialize_default_harnesses()

    def _initialize_default_harnesses(self):
        """Initialize default harnesses."""
        # PHAOS - default harness
        self.register(HarnessDefinition(
            id="phaos",
            name="PHAOS",
            version="2.0.0",
            description="The default harness with AV2 amplification + Alethea V2 grounding",
            entry_point="phaos.engine.orchestrator:orchestrator",
            supports_file_tools=True,
            supports_terminal=True,
            supports_git=True,
            supports_cron=True,
            status=HarnessStatus.ACTIVE,
        ))

        # Raw Model - direct LLM calls
        self.register(HarnessDefinition(
            id="raw",
            name="Raw Model",
            version="1.0.0",
            description="Direct LLM calls — no orchestration, no amplification, no grounding",
            entry_point="raw_model:direct_call",
            supports_file_tools=False,
            supports_terminal=False,
            supports_git=False,
            supports_cron=False,
            status=HarnessStatus.INACTIVE,
        ))

        # Custom Harness - user-uploaded
        self.register(HarnessDefinition(
            id="custom",
            name="Custom Harness",
            version="1.0.0",
            description="User-uploaded harness (requires a ZIP file with Python code)",
            entry_point="custom:load_from_zip",
            supports_file_tools=False,
            supports_terminal=False,
            supports_git=False,
            supports_cron=False,
            status=HarnessStatus.INACTIVE,
        ))

        # Set PHAOS as active
        self._active_harness_id = "phaos"

    def register(self, harness: HarnessDefinition) -> None:
        """Register a new harness."""
        self._harnesses[harness.id] = harness

    def unregister(self, harness_id: str) -> bool:
        """Unregister a harness."""
        if harness_id in self._harnesses:
            # Cannot unregister the active harness
            if self._active_harness_id == harness_id:
                raise ValueError("Cannot unregister the active harness")
            del self._harnesses[harness_id]
            return True
        return False

    def activate(self, harness_id: str) -> bool:
        """Activate a harness."""
        if harness_id not in self._harnesses:
            raise ValueError(f"Harness {harness_id} not found")

        # Deactivate current active harness
        if self._active_harness_id and self._active_harness_id in self._harnesses:
            self._harnesses[self._active_harness_id].status = HarnessStatus.INACTIVE

        # Activate new harness
        self._harnesses[harness_id].status = HarnessStatus.ACTIVE
        self._active_harness_id = harness_id
        return True

    def get_active(self) -> Optional[HarnessDefinition]:
        """Get the currently active harness."""
        if self._active_harness_id:
            return self._harnesses.get(self._active_harness_id)
        return None

    def get_harness(self, harness_id: str) -> Optional[HarnessDefinition]:
        """Get a harness by ID."""
        return self._harnesses.get(harness_id)

    def list_all(self) -> list[HarnessDefinition]:
        """List all registered harnesses."""
        return list(self._harnesses.values())

    def list_available(self) -> list[HarnessDefinition]:
        """List all available (non-error) harnesses."""
        return [h for h in self._harnesses.values() if h.status != HarnessStatus.ERROR]

    def install_custom_harness(
        self,
        harness_id: str,
        name: str,
        version: str,
        description: str,
        entry_point: str,
        **kwargs,
    ) -> HarnessDefinition:
        """Install a custom harness."""
        if harness_id in self._harnesses:
            raise ValueError(f"Harness {harness_id} already exists")

        harness = HarnessDefinition(
            id=harness_id,
            name=name,
            version=version,
            description=description,
            entry_point=entry_point,
            supports_file_tools=kwargs.get("supports_file_tools", False),
            supports_terminal=kwargs.get("supports_terminal", False),
            supports_git=kwargs.get("supports_git", False),
            supports_cron=kwargs.get("supports_cron", False),
            status=HarnessStatus.INACTIVE,
            metadata=kwargs.get("metadata", {}),
        )

        self.register(harness)
        return harness

    def get_harness_status(self) -> Dict[str, Any]:
        """Get status of all harnesses."""
        active = self.get_active()
        return {
            "active_harness": active.id if active else None,
            "total_harnesses": len(self._harnesses),
            "harnesses": [
                {
                    "id": h.id,
                    "name": h.name,
                    "version": h.version,
                    "status": h.status.value,
                }
                for h in self._harnesses.values()
            ],
        }


# Global harness registry instance
_registry: Optional[HarnessRegistry] = None


def get_registry() -> HarnessRegistry:
    """Get or create the global harness registry."""
    global _registry
    if _registry is None:
        _registry = HarnessRegistry()
    return _registry


def reset_registry() -> None:
    """Reset the global harness registry (for testing)."""
    global _registry
    _registry = None
