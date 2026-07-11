"""First-run check for PHAOS backend."""

from __future__ import annotations

import os
import sys
from pathlib import Path
from typing import Optional
import threading


def check_model_cached() -> bool:
    """Check if the Alethea classifier model is cached."""
    try:
        import transformers
        from transformers import AutoTokenizer
        
        # Check if tokenizer is cached
        cache_dir = Path.home() / ".cache" / "huggingface"
        if not cache_dir.exists():
            return False
        
        # Check for model files
        model_name = "distilbert-base-uncased-mnli"
        model_dirs = list(cache_dir.glob(f"*{model_name}*"))
        
        return len(model_dirs) > 0
    except ImportError:
        return False


def download_model_background(callback=None):
    """Download the model in a background thread."""
    def _download():
        try:
            from transformers import AutoModelForSequenceClassification, AutoTokenizer
            
            # Download tokenizer
            tokenizer = AutoTokenizer.from_pretrained("distilbert-base-uncased-mnli")
            
            # Download model
            model = AutoModelForSequenceClassification.from_pretrained("distilbert-base-uncased-mnli")
            
            if callback:
                callback(True, "Model downloaded successfully")
        except Exception as e:
            if callback:
                callback(False, str(e))
    
    thread = threading.Thread(target=_download, daemon=True)
    thread.start()
    return thread


def get_first_run_status() -> dict:
    """Get first-run status information."""
    model_cached = check_model_cached()
    
    return {
        "model_cached": model_cached,
        "model_name": "distilbert-base-uncased-mnli",
        "cache_dir": str(Path.home() / ".cache" / "huggingface"),
        "first_run": not model_cached,
    }


if __name__ == "__main__":
    status = get_first_run_status()
    print("First-run status:")
    for key, value in status.items():
        print(f"  {key}: {value}")
