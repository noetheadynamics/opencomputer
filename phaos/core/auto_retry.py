"""Auto-Retry Loop — retries failed operations with error context."""

from __future__ import annotations

import logging
from typing import Callable, Dict, Any, Optional, Awaitable

logger = logging.getLogger(__name__)


class AutoRetryLoop:
    """Retries failed operations up to max_retries times."""

    def __init__(self, max_retries: int = 3):
        self.max_retries = max_retries

    async def execute_with_retry(
        self,
        query: str,
        model_callback: Callable[[str], Awaitable[Dict[str, Any]]],
        error_callback: Optional[Callable[[str, str], Awaitable[None]]] = None,
    ) -> Dict[str, Any]:
        """Execute a query with automatic retry on failure."""
        attempts = 0
        last_error = None
        responses = []
        current_query = query

        while attempts < self.max_retries:
            attempts += 1
            try:
                result = await model_callback(current_query)
                responses.append(result)

                if self._is_success(result):
                    logger.info(f"Succeeded on attempt {attempts}")
                    return {
                        "success": True,
                        "result": result,
                        "attempts": attempts,
                        "history": responses,
                    }

                # If not successful but no exception, treat as failure
                last_error = result.get("error", "Unknown error")

            except Exception as e:
                last_error = str(e)
                logger.warning(f"Attempt {attempts} failed: {last_error}")

            # Modify query with error context for next attempt
            if attempts < self.max_retries:
                current_query = (
                    f"{query}\n\n"
                    f"Previous attempt failed with error: {last_error}. "
                    f"Try a different approach."
                )
                if error_callback:
                    await error_callback(current_query, last_error)

        logger.error(f"All {self.max_retries} attempts failed")
        return {
            "success": False,
            "error": last_error,
            "attempts": attempts,
            "history": responses,
        }

    def _is_success(self, result: Dict[str, Any]) -> bool:
        """Check if a result indicates success."""
        if isinstance(result, dict):
            return result.get("success", False)
        return bool(result)
