"""Tests for harness slot management."""

import pytest
import os
import sys

# Add parent directory to path for imports
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from engine.core.harness_slot import (
    HarnessDefinition,
    HarnessRegistry,
    HarnessStatus,
    get_registry,
    reset_registry,
)


@pytest.fixture(autouse=True)
def reset_registry_fixture():
    """Reset registry before each test."""
    reset_registry()
    yield
    reset_registry()


class TestHarnessDefinition:
    """Tests for HarnessDefinition."""

    def test_create_harness_definition(self):
        """Test creating a harness definition."""
        harness = HarnessDefinition(
            id="test",
            name="Test Harness",
            version="1.0.0",
            description="A test harness",
            entry_point="test:main",
        )
        
        assert harness.id == "test"
        assert harness.name == "Test Harness"
        assert harness.version == "1.0.0"
        assert harness.status == HarnessStatus.INACTIVE

    def test_harness_default_capabilities(self):
        """Test default capabilities are set."""
        harness = HarnessDefinition(
            id="test",
            name="Test",
            version="1.0.0",
            description="Test",
            entry_point="test:main",
        )
        
        assert harness.supports_file_tools is True
        assert harness.supports_terminal is True
        assert harness.supports_git is True
        assert harness.supports_cron is True


class TestHarnessRegistry:
    """Tests for HarnessRegistry."""

    def test_registry_initialization(self):
        """Test registry initialization with default harnesses."""
        registry = HarnessRegistry()
        harnesses = registry.list_all()
        
        assert len(harnesses) == 3
        assert any(h.id == "phaos" for h in harnesses)
        assert any(h.id == "raw" for h in harnesses)
        assert any(h.id == "custom" for h in harnesses)

    def test_registry_active_harness(self):
        """Test that PHAOS is active by default."""
        registry = HarnessRegistry()
        active = registry.get_active()
        
        assert active is not None
        assert active.id == "phaos"
        assert active.status == HarnessStatus.ACTIVE

    def test_register_new_harness(self):
        """Test registering a new harness."""
        registry = HarnessRegistry()
        
        new_harness = HarnessDefinition(
            id="new",
            name="New Harness",
            version="1.0.0",
            description="A new harness",
            entry_point="new:main",
        )
        
        registry.register(new_harness)
        harnesses = registry.list_all()
        
        assert len(harnesses) == 4
        assert any(h.id == "new" for h in harnesses)

    def test_activate_harness(self):
        """Test activating a different harness."""
        registry = HarnessRegistry()
        
        success = registry.activate("raw")
        
        assert success is True
        active = registry.get_active()
        assert active.id == "raw"
        assert active.status == HarnessStatus.ACTIVE
        
        # Previous harness should be inactive
        phaos = registry.get_harness("phaos")
        assert phaos.status == HarnessStatus.INACTIVE

    def test_activate_nonexistent_harness(self):
        """Test activating a nonexistent harness."""
        registry = HarnessRegistry()
        
        with pytest.raises(ValueError, match="not found"):
            registry.activate("nonexistent")

    def test_unregister_harness(self):
        """Test unregistering a harness."""
        registry = HarnessRegistry()
        
        success = registry.unregister("raw")
        
        assert success is True
        harnesses = registry.list_all()
        assert len(harnesses) == 2
        assert not any(h.id == "raw" for h in harnesses)

    def test_unregister_active_harness_fails(self):
        """Test that unregistering active harness fails."""
        registry = HarnessRegistry()
        
        with pytest.raises(ValueError, match="Cannot unregister"):
            registry.unregister("phaos")

    def test_unregister_nonexistent_harness(self):
        """Test unregistering a nonexistent harness."""
        registry = HarnessRegistry()
        
        success = registry.unregister("nonexistent")
        assert success is False

    def test_install_custom_harness(self):
        """Test installing a custom harness."""
        registry = HarnessRegistry()
        
        harness = registry.install_custom_harness(
            harness_id="custom1",
            name="Custom 1",
            version="1.0.0",
            description="Custom harness",
            entry_point="custom1:main",
        )
        
        assert harness.id == "custom1"
        assert harness.status == HarnessStatus.INACTIVE
        
        harnesses = registry.list_all()
        assert len(harnesses) == 4

    def test_install_duplicate_harness_fails(self):
        """Test installing a duplicate harness fails."""
        registry = HarnessRegistry()
        
        with pytest.raises(ValueError, match="already exists"):
            registry.install_custom_harness(
                harness_id="phaos",
                name="Duplicate",
                version="1.0.0",
                description="Duplicate",
                entry_point="dup:main",
            )

    def test_get_harness_status(self):
        """Test getting harness status."""
        registry = HarnessRegistry()
        
        status = registry.get_harness_status()
        
        assert "active_harness" in status
        assert "total_harnesses" in status
        assert "harnesses" in status
        assert status["total_harnesses"] == 3
        assert status["active_harness"] == "phaos"

    def test_list_available_harnesses(self):
        """Test listing available harnesses."""
        registry = HarnessRegistry()
        
        available = registry.list_available()
        
        assert len(available) == 3

    def test_get_registry_singleton(self):
        """Test get_registry returns singleton."""
        registry1 = get_registry()
        registry2 = get_registry()
        
        assert registry1 is registry2

    def test_reset_registry(self):
        """Test reset_registry creates new instance."""
        registry1 = get_registry()
        reset_registry()
        registry2 = get_registry()
        
        assert registry1 is not registry2
