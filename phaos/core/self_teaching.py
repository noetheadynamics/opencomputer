"""Self-Teaching Loop — learns from every interaction."""

from __future__ import annotations

import re
from typing import Dict, Any, Optional, List
from .memory_store import MemoryStore


class SelfTeachingLoop:
    """Extracts learnings from interactions and stores them."""

    def __init__(self, memory_store: MemoryStore):
        self.memory = memory_store

    def reflect(self, interaction_id: str) -> Dict[str, Any]:
        """Reflect on an interaction and extract learnings."""
        interaction = self.memory.get_interaction(interaction_id)
        if not interaction:
            return {"reflected": False, "error": "Interaction not found"}

        success = bool(interaction["success"])
        query = interaction["query"]
        response = interaction["response"]

        if success:
            return self._learn_from_success(query, response, interaction)
        else:
            return self._learn_from_failure(query, response, interaction)

    def _learn_from_success(
        self, query: str, response: str, interaction: Dict
    ) -> Dict[str, Any]:
        """Capture successful patterns as skills."""
        pattern = self._extract_pattern(query, response)
        tags = self._extract_tags(query)

        # Store as a learning
        self.memory.store_interaction(
            query=query,
            response=response,
            success=True,
            metadata={
                "type": "learning",
                "pattern": pattern,
                "tags": tags,
                "source": "self_teaching",
            },
        )

        return {
            "reflected": True,
            "type": "success",
            "pattern": pattern,
            "tags": tags,
        }

    def _learn_from_failure(
        self, query: str, response: str, interaction: Dict
    ) -> Dict[str, Any]:
        """Store failure patterns to avoid repeating."""
        metadata = interaction.get("metadata", {})
        if isinstance(metadata, str):
            import json
            try:
                metadata = json.loads(metadata)
            except Exception:
                metadata = {"error": metadata}

        failure_pattern = {
            "query_type": self._classify_query(query),
            "error_type": metadata.get("error", "unknown"),
            "attempted_approach": response[:200] if response else "",
        }

        self.memory.store_failure(
            query=query,
            error=metadata.get("error", "unknown"),
            attempted_solution=response or "",
        )

        return {
            "reflected": True,
            "type": "failure",
            "failure_pattern": failure_pattern,
        }

    def _extract_pattern(self, query: str, response: str) -> str:
        """Extract a reusable pattern from a successful interaction."""
        # Simple pattern extraction based on query type
        query_lower = query.lower()

        if any(kw in query_lower for kw in ["write", "create", "generate", "build"]):
            return "code_generation"
        elif any(kw in query_lower for kw in ["fix", "debug", "error", "bug"]):
            return "debugging"
        elif any(kw in query_lower for kw in ["explain", "what", "how", "why"]):
            return "explanation"
        elif any(kw in query_lower for kw in ["design", "ui", "layout", "style"]):
            return "design"
        elif any(kw in query_lower for kw in ["test", "verify", "check"]):
            return "testing"
        else:
            return "general"

    def _extract_tags(self, query: str) -> List[str]:
        """Extract relevant tags from a query."""
        tags = []
        query_lower = query.lower()

        # Language tags
        if "python" in query_lower:
            tags.append("python")
        if "javascript" in query_lower or "js" in query_lower:
            tags.append("javascript")
        if "typescript" in query_lower or "ts" in query_lower:
            tags.append("typescript")
        if "rust" in query_lower:
            tags.append("rust")

        # Concept tags
        if "api" in query_lower:
            tags.append("api")
        if "database" in query_lower or "sql" in query_lower:
            tags.append("database")
        if "ui" in query_lower or "frontend" in query_lower:
            tags.append("frontend")
        if "backend" in query_lower:
            tags.append("backend")

        return tags if tags else ["general"]

    def _classify_query(self, query: str) -> str:
        """Classify query type for failure patterns."""
        query_lower = query.lower()

        if any(kw in query_lower for kw in ["write", "create", "generate"]):
            return "code_generation"
        elif any(kw in query_lower for kw in ["fix", "debug", "error"]):
            return "debugging"
        elif any(kw in query_lower for kw in ["explain", "what", "how"]):
            return "explanation"
        elif any(kw in query_lower for kw in ["design", "ui", "layout"]):
            return "design"
        else:
            return "general"

    def get_learnings(self, query: str, top_k: int = 5) -> List[Dict]:
        """Retrieve relevant learnings for a query."""
        similar = self.memory.retrieve_similar(query, top_k=top_k)
        learnings = []
        for item in similar:
            metadata = item.get("metadata", "{}") or "{}"
            if isinstance(metadata, str):
                import json
                try:
                    metadata = json.loads(metadata)
                except Exception:
                    metadata = {}

            if metadata.get("type") == "learning":
                learnings.append(
                    {
                        "pattern": metadata.get("pattern", "general"),
                        "tags": metadata.get("tags", []),
                        "response": item.get("response", ""),
                    }
                )
        return learnings
