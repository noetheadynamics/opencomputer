"""Feedback Loop — stores and applies user corrections."""

from __future__ import annotations

from typing import Optional
from .memory_store import MemoryStore


class FeedbackLoop:
    """Stores user corrections and applies them to future responses."""

    def __init__(self, memory_store: MemoryStore):
        self.memory = memory_store

    def store_correction(
        self,
        query: str,
        original_response: str,
        corrected_response: str,
    ) -> str:
        """Store a user correction."""
        return self.memory.store_interaction(
            query=query,
            response=corrected_response,
            success=True,
            user_correction=corrected_response,
            metadata={
                "original_response": original_response,
                "type": "correction",
            },
        )

    def apply_corrections(self, query: str, response: str) -> str:
        """Apply past corrections to a response if available."""
        corrections = self.memory.get_corrections_for_query(query)
        if corrections:
            return corrections[-1]
        return response

    def has_corrections(self, query: str) -> bool:
        """Check if there are corrections for a query."""
        corrections = self.memory.get_corrections_for_query(query)
        return len(corrections) > 0
