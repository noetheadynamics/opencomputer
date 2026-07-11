"""Realtime ReAct Streaming — SSE-based step streaming to the UI."""

from __future__ import annotations

import asyncio
import json
import logging
from datetime import datetime, timezone
from typing import Dict, Any, Optional

logger = logging.getLogger(__name__)


class ReActStreamer:
    """Streams ReAct steps to the frontend via SSE."""

    def __init__(self):
        self._queues: Dict[str, asyncio.Queue] = {}
        self._completed: Dict[str, bool] = {}

    def subscribe(self, task_id: str) -> asyncio.Queue:
        """Subscribe to updates for a task."""
        self._queues[task_id] = asyncio.Queue()
        self._completed[task_id] = False
        return self._queues[task_id]

    def unsubscribe(self, task_id: str):
        """Unsubscribe from a task."""
        self._queues.pop(task_id, None)
        self._completed.pop(task_id, None)

    async def emit(
        self,
        task_id: str,
        step_type: str,
        content: str,
        data: Optional[Dict[str, Any]] = None,
    ):
        """Emit a step to all subscribers of a task."""
        if task_id not in self._queues:
            return

        payload = {
            "type": step_type,
            "content": content,
            "data": data or {},
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }

        try:
            await self._queues[task_id].put(json.dumps(payload))
        except Exception as e:
            logger.warning(f"Failed to emit step for task {task_id}: {e}")

    async def complete(self, task_id: str):
        """Signal that a task is complete."""
        if task_id in self._queues:
            self._completed[task_id] = True
            await self._queues[task_id].put(None)

    async def stream(self, task_id: str):
        """Generator that yields SSE-formatted messages."""
        queue = self.subscribe(task_id)
        try:
            while True:
                data = await queue.get()
                if data is None:
                    break
                yield f"data: {data}\n\n"
        except asyncio.CancelledError:
            pass
        finally:
            self.unsubscribe(task_id)

    def emit_sync(
        self,
        task_id: str,
        step_type: str,
        content: str,
        data: Optional[Dict[str, Any]] = None,
    ):
        """Synchronous emit for use in non-async contexts."""
        if task_id not in self._queues:
            return

        payload = {
            "type": step_type,
            "content": content,
            "data": data or {},
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }

        try:
            loop = asyncio.get_running_loop()
            asyncio.ensure_future(self._queues[task_id].put(json.dumps(payload)))
        except RuntimeError:
            try:
                loop = asyncio.get_event_loop()
                if loop.is_running():
                    asyncio.ensure_future(self._queues[task_id].put(json.dumps(payload)))
                else:
                    loop.run_until_complete(self._queues[task_id].put(json.dumps(payload)))
            except RuntimeError:
                pass


# Global streamer instance
_streamer: Optional[ReActStreamer] = None


def get_streamer() -> ReActStreamer:
    """Get or create the global streamer instance."""
    global _streamer
    if _streamer is None:
        _streamer = ReActStreamer()
    return _streamer
