"""Cron Scheduler — background task scheduling with APScheduler."""

from __future__ import annotations

import logging
from typing import Dict, Any, Optional, Callable, Awaitable

logger = logging.getLogger(__name__)


class CronScheduler:
    """Background scheduler for cron tasks."""

    def __init__(self):
        self._scheduler = None
        self._jobs: Dict[str, Dict] = {}
        self._task_callback: Optional[Callable] = None
        self._is_async_scheduler = False

    def set_task_callback(self, callback: Callable[[str, Dict], Awaitable[None]]):
        """Set the callback to execute scheduled tasks."""
        self._task_callback = callback

    def start(self):
        """Start the scheduler."""
        try:
            from apscheduler.schedulers.asyncio import AsyncIOScheduler

            self._scheduler = AsyncIOScheduler()
            self._scheduler.start()
            self._is_async_scheduler = True
            logger.info("Cron scheduler started")
        except ImportError:
            logger.warning("APScheduler not installed — cron scheduler disabled")
        except RuntimeError:
            # No event loop running — try BackgroundScheduler instead
            try:
                from apscheduler.schedulers.background import BackgroundScheduler

                self._scheduler = BackgroundScheduler()
                self._scheduler.start()
                self._is_async_scheduler = False
                logger.info("Cron scheduler started (background mode)")
            except Exception as e:
                logger.error(f"Failed to start scheduler: {e}")
        except Exception as e:
            logger.error(f"Failed to start scheduler: {e}")

    def stop(self):
        """Stop the scheduler."""
        if self._scheduler:
            self._scheduler.shutdown(wait=False)
            logger.info("Cron scheduler stopped")

    def schedule_task(
        self,
        task_id: str,
        schedule: str,
        payload: Dict[str, Any],
    ) -> bool:
        """Schedule a task. Returns True if scheduled successfully."""
        if not self._scheduler:
            logger.warning("Scheduler not running")
            return False

        try:
            trigger = self._parse_trigger(schedule)
            if trigger is None:
                logger.error(f"Invalid schedule: {schedule}")
                return False

            callback = self._execute_task if self._is_async_scheduler else self._execute_task_sync
            self._scheduler.add_job(
                func=callback,
                trigger=trigger,
                args=[task_id, payload],
                id=task_id,
                replace_existing=True,
            )
            self._jobs[task_id] = {
                "schedule": schedule,
                "payload": payload,
            }
            logger.info(f"Scheduled task {task_id}: {schedule}")
            return True
        except Exception as e:
            logger.error(f"Failed to schedule task {task_id}: {e}")
            return False

    def remove_task(self, task_id: str) -> bool:
        """Remove a scheduled task."""
        if not self._scheduler:
            return False

        try:
            self._scheduler.remove_job(task_id)
            self._jobs.pop(task_id, None)
            logger.info(f"Removed scheduled task {task_id}")
            return True
        except Exception:
            return False

    def get_jobs(self) -> Dict[str, Dict]:
        """Get all scheduled jobs."""
        return dict(self._jobs)

    async def _execute_task(self, task_id: str, payload: Dict[str, Any]):
        """Execute a scheduled task."""
        if self._task_callback is None:
            logger.error(f"No task callback set for task {task_id}")
            return

        try:
            logger.info(f"Executing scheduled task {task_id}")
            await self._task_callback(task_id, payload)
        except Exception as e:
            logger.error(f"Scheduled task {task_id} failed: {e}")

    def _execute_task_sync(self, task_id: str, payload: Dict[str, Any]):
        """Execute a scheduled task from a non-async context (BackgroundScheduler)."""
        if self._task_callback is None:
            logger.error(f"No task callback set for task {task_id}")
            return

        try:
            import asyncio
            logger.info(f"Executing scheduled task {task_id}")
            try:
                loop = asyncio.get_running_loop()
            except RuntimeError:
                loop = None

            if loop and loop.is_running():
                asyncio.run_coroutine_threadsafe(self._task_callback(task_id, payload), loop)
            else:
                asyncio.run(self._task_callback(task_id, payload))
        except Exception as e:
            logger.error(f"Scheduled task {task_id} failed: {e}")

    def _parse_trigger(self, schedule: str):
        """Parse a schedule string into an APScheduler trigger."""
        try:
            from apscheduler.triggers.cron import CronTrigger
            from apscheduler.triggers.interval import IntervalTrigger

            # Cron expression (5+ fields)
            parts = schedule.strip().split()
            if len(parts) >= 5:
                return CronTrigger.from_crontab(schedule)

            # Interval in seconds
            interval = int(schedule)
            return IntervalTrigger(seconds=interval)
        except (ValueError, ImportError):
            return None
