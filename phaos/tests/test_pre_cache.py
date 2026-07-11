"""Tests for model pre-caching functionality."""

import pytest
from unittest.mock import patch, MagicMock
import sys


class TestPreCacheModels:
    """Tests for model pre-caching."""

    def test_check_model_cached_returns_boolean(self):
        """Test that check_model_cached returns a boolean."""
        from phaos.scripts.first_run import check_model_cached
        
        result = check_model_cached()
        assert isinstance(result, bool)

    def test_get_first_run_status(self):
        """Test get_first_run_status returns expected structure."""
        from phaos.scripts.first_run import get_first_run_status
        
        status = get_first_run_status()
        
        assert "model_cached" in status
        assert "model_name" in status
        assert "cache_dir" in status
        assert "first_run" in status
        assert status["model_name"] == "distilbert-base-uncased-mnli"

    def test_first_run_status_model_cached(self):
        """Test first_run status when model is cached."""
        from phaos.scripts.first_run import get_first_run_status
        
        status = get_first_run_status()
        
        # first_run should be opposite of model_cached
        assert status["first_run"] == (not status["model_cached"])

    @patch("phaos.scripts.first_run.check_model_cached")
    def test_download_model_background_starts_thread(self, mock_check):
        """Test that download_model_background starts a thread."""
        from phaos.scripts.first_run import download_model_background
        
        mock_check.return_value = False
        
        # This should not raise an error
        thread = download_model_background()
        assert thread is not None
        assert thread.daemon is True


class TestPreCacheScript:
    """Tests for the pre-cache script."""

    def test_script_imports(self):
        """Test that the pre-cache script can be imported."""
        import phaos.scripts.pre_cache_models as script
        
        assert hasattr(script, "main")

    def test_main_function_exists(self):
        """Test that main function exists and is callable."""
        from phaos.scripts.pre_cache_models import main
        
        assert callable(main)
