#!/usr/bin/env python3
"""
Pre-cache the Alethea classifier model so first run is fast.

Usage:
    python phaos/scripts/pre_cache_models.py

This script downloads the distilbert-base-uncased-mnli model used by
the Alethea classifier for query categorization. The model is cached
in the HuggingFace cache directory (~/.cache/huggingface/).
"""

import sys
import os

def main():
    print("=" * 60)
    print("OpenComputer - Model Pre-Cache")
    print("=" * 60)
    print()
    
    # Check if transformers is installed
    try:
        import transformers
        print(f"[OK] transformers {transformers.__version__} installed")
    except ImportError:
        print("[ERROR] transformers not installed")
        print("       Install with: pip install transformers")
        sys.exit(1)
    
    # Check if torch is installed
    try:
        import torch
        print(f"[OK] torch {torch.__version__} installed")
    except ImportError:
        print("[ERROR] torch not installed")
        print("       Install with: pip install torch")
        sys.exit(1)
    
    print()
    print("Downloading Alethea classifier model...")
    print("Model: distilbert-base-uncased-mnli")
    print("This may take a few minutes on first run.")
    print()
    
    try:
        from transformers import AutoModelForSequenceClassification, AutoTokenizer
        
        # Download tokenizer
        print("[1/2] Downloading tokenizer...")
        tokenizer = AutoTokenizer.from_pretrained("distilbert-base-uncased-mnli")
        print("[OK] Tokenizer downloaded")
        
        # Download model
        print("[2/2] Downloading model...")
        model = AutoModelForSequenceClassification.from_pretrained("distilbert-base-uncased-mnli")
        print("[OK] Model downloaded")
        
        print()
        print("=" * 60)
        print("SUCCESS: Model downloaded and cached successfully!")
        print("=" * 60)
        print()
        print("The model is now cached in:")
        print("  ~/.cache/huggingface/")
        print()
        print("First run of OpenComputer will now be fast.")
        
    except Exception as e:
        print()
        print("=" * 60)
        print(f"ERROR: Failed to download model: {e}")
        print("=" * 60)
        print()
        print("Troubleshooting:")
        print("  1. Check your internet connection")
        print("  2. Ensure you have enough disk space (~500MB)")
        print("  3. Try running: pip install --upgrade transformers torch")
        sys.exit(1)


if __name__ == "__main__":
    main()
