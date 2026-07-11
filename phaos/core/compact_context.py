"""DCP-Inspired Model-Driven Compaction — compact, discard, protect, prune tools for context management."""

from __future__ import annotations

import logging
from typing import List, Dict, Any, Optional

logger = logging.getLogger(__name__)

try:
    import tiktoken
    HAS_TIKTOKEN = True
except ImportError:
    HAS_TIKTOKEN = False


MODEL_MAX_TOKENS = {
    "gpt-4": 8192,
    "gpt-4-32k": 32768,
    "gpt-4o": 128000,
    "gpt-4o-mini": 128000,
    "claude-3-5-sonnet": 200000,
    "claude-3-haiku": 200000,
    "deepseek-coder": 32768,
    "default": 8192,
}

AUTO_COMPACT_THRESHOLD = 0.80


class CompactContext:
    """DCP-inspired model-driven context compaction.

    The model decides *what* to compact, discard, protect, or prune.
    This class provides the tools and token accounting.
    """

    def __init__(self, model_name: str = "default"):
        self.model_name = model_name
        self.max_tokens = MODEL_MAX_TOKENS.get(model_name, MODEL_MAX_TOKENS["default"])
        self.threshold = AUTO_COMPACT_THRESHOLD

        self._encoder = None
        if HAS_TIKTOKEN:
            try:
                self._encoder = tiktoken.encoding_for_model(model_name)
            except KeyError:
                logger.warning(f"No tiktoken encoder for model '{model_name}', falling back to cl100k_base")
                try:
                    self._encoder = tiktoken.get_encoding("cl100k_base")
                except Exception:
                    pass
        if self._encoder is None:
            logger.warning("tiktoken unavailable; using character-count approximation for token counting")

    def count_tokens(self, text: str) -> int:
        if self._encoder:
            return len(self._encoder.encode(text))
        return len(text) // 4

    def get_usage(self, messages: List[Dict]) -> Dict[str, Any]:
        """Get token usage stats for a message list."""
        total = sum(self.count_tokens(m.get("content", "")) for m in messages)
        return {
            "total": total,
            "max": self.max_tokens,
            "used_percent": round(total / self.max_tokens * 100, 2) if self.max_tokens > 0 else 0,
            "should_auto_compact": total > self.max_tokens * self.threshold,
        }

    # ── DCP Tools (called by the model) ─────────────────────────────

    def compact(self, messages: List[Dict], start: int, end: int, summary: str) -> List[Dict]:
        """Replace a range of messages with a high-fidelity summary.

        Protected messages within the range are kept.
        """
        protected = {i for i, m in enumerate(messages) if m.get("protected", False)}
        actual_start = max(start, 0)
        actual_end = min(end, len(messages))
        new_msgs = []
        summary_inserted = False
        dropped_count = 0
        for i, m in enumerate(messages):
            if i in protected or i < actual_start or i >= actual_end:
                new_msgs.append(m)
            elif i == actual_start and not summary_inserted:
                new_msgs.append({"role": "system", "content": f"Compacted summary: {summary}"})
                summary_inserted = True
            else:
                dropped_count += 1
        if dropped_count > 0:
            logger.debug(f"Compaction dropped {dropped_count} messages in range [{actual_start}, {actual_end})")
        return new_msgs

    def discard(self, messages: List[Dict], message_ids: List[int]) -> List[Dict]:
        """Remove specific tool call outputs (never discards user messages or protected)."""
        discard_set = set(message_ids)
        return [
            m for i, m in enumerate(messages)
            if i not in discard_set or m.get("protected", False) or m.get("role") == "user"
        ]

    def protect(self, messages: List[Dict], message_ids: List[int]) -> List[Dict]:
        """Mark messages as protected — they will never be compacted or discarded."""
        for i in message_ids:
            if 0 <= i < len(messages):
                messages[i]["protected"] = True
        return messages

    def prune(self, messages: List[Dict], tool_call_ids: List[str]) -> List[Dict]:
        """Remove obsolete or failed tool call inputs by tool_call_id."""
        prune_set = set(tool_call_ids)
        return [
            m for m in messages
            if not (m.get("tool_call_id") in prune_set)
        ]


# ── Tool definitions for the model ─────────────────────────────────

COMPACT_TOOL_DEFINITIONS = [
    {
        "type": "function",
        "function": {
            "name": "compact",
            "description": "Compress older messages into a high-fidelity summary when the context window is approaching its limit.",
            "parameters": {
                "type": "object",
                "properties": {
                    "start": {"type": "integer", "description": "Index of the first message to compact"},
                    "end": {"type": "integer", "description": "Index of the last message to compact (exclusive)"},
                    "summary": {"type": "string", "description": "High-fidelity technical summary of the compacted messages"},
                },
                "required": ["start", "end", "summary"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "discard",
            "description": "Remove completed or noisy tool call outputs to free up context window space.",
            "parameters": {
                "type": "object",
                "properties": {
                    "message_ids": {"type": "array", "items": {"type": "integer"}},
                },
                "required": ["message_ids"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "protect",
            "description": "Mark messages as protected — they will never be compacted or discarded.",
            "parameters": {
                "type": "object",
                "properties": {
                    "message_ids": {"type": "array", "items": {"type": "integer"}},
                },
                "required": ["message_ids"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "prune",
            "description": "Remove obsolete or failed tool call inputs.",
            "parameters": {
                "type": "object",
                "properties": {
                    "tool_call_ids": {"type": "array", "items": {"type": "string"}},
                },
                "required": ["tool_call_ids"],
            },
        },
    },
]


def get_auto_compact_reminder(usage: Dict[str, Any]) -> str:
    """Generate a system reminder when auto-compaction is needed."""
    return (
        f"Context usage is {usage['used_percent']}% ({usage['total']}/{usage['max']} tokens). "
        "If you need more space, call `compact` to summarize older messages, "
        "or `discard` to remove tool outputs."
    )


# ── Singleton ───────────────────────────────────────────────────────

_compact_context: Optional[CompactContext] = None


def get_compact_context(model_name: str = "default") -> CompactContext:
    global _compact_context
    if _compact_context is None or _compact_context.model_name != model_name:
        _compact_context = CompactContext(model_name)
    return _compact_context
