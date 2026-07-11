"""SQLite database implementation for PHAOS persistent storage."""

from __future__ import annotations

import os
import sqlite3
import threading
from datetime import datetime, timezone
from typing import Optional

from .schemas import (
    Task,
    TaskStatus,
    TaskCreate,
    HarnessSlot,
    SlotStatus,
    Skill,
    AuditLog,
    CronJob,
)

DB_PATH = os.getenv("PHAOS_DB_PATH", "./phaos_data.db")


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _id() -> str:
    import uuid
    return uuid.uuid4().hex[:12]


class Database:
    """SQLite database for PHAOS persistent storage."""

    def __init__(self, db_path: str = DB_PATH):
        self.db_path = db_path
        self._lock = threading.Lock()
        self.conn = sqlite3.connect(db_path, check_same_thread=False)
        self.conn.row_factory = sqlite3.Row
        self.conn.execute("PRAGMA foreign_keys = ON;")
        self.conn.execute("PRAGMA journal_mode=WAL;")
        self._create_tables()

    def _create_tables(self):
        """Create tables if they don't exist."""
        cursor = self.conn.cursor()
        cursor.executescript("""
            CREATE TABLE IF NOT EXISTS tasks (
                id TEXT PRIMARY KEY,
                prompt TEXT NOT NULL,
                model TEXT NOT NULL,
                status TEXT NOT NULL,
                result TEXT,
                error TEXT,
                category INTEGER,
                iterations INTEGER DEFAULT 0,
                amplifications_applied TEXT DEFAULT '[]',
                tool_calls_made INTEGER DEFAULT 0,
                total_time REAL DEFAULT 0.0,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS harness_slots (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                status TEXT NOT NULL,
                owner_task_id TEXT,
                metadata TEXT DEFAULT '{}',
                FOREIGN KEY (owner_task_id) REFERENCES tasks(id)
            );

            CREATE TABLE IF NOT EXISTS skills (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                description TEXT NOT NULL,
                command TEXT NOT NULL,
                enabled INTEGER DEFAULT 1
            );

            CREATE TABLE IF NOT EXISTS audit_logs (
                id TEXT PRIMARY KEY,
                action TEXT NOT NULL,
                outcome TEXT NOT NULL,
                details TEXT,
                timestamp TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS cron_jobs (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                schedule TEXT NOT NULL,
                command TEXT NOT NULL,
                enabled INTEGER DEFAULT 1,
                last_run TEXT,
                next_run TEXT,
                created_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS harness_configs (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                version TEXT NOT NULL,
                description TEXT NOT NULL,
                entry_point TEXT NOT NULL,
                supports_file_tools INTEGER DEFAULT 1,
                supports_terminal INTEGER DEFAULT 1,
                supports_git INTEGER DEFAULT 1,
                supports_cron INTEGER DEFAULT 1,
                is_active INTEGER DEFAULT 0,
                created_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS conversations (
                id TEXT PRIMARY KEY,
                title TEXT NOT NULL DEFAULT 'New Chat',
                provider_label TEXT,
                model_name TEXT,
                harness_id TEXT NOT NULL DEFAULT 'phaos',
                is_archived INTEGER DEFAULT 0,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL,
                system_prompt TEXT
            );

            CREATE TABLE IF NOT EXISTS messages (
                id TEXT PRIMARY KEY,
                conversation_id TEXT NOT NULL,
                role TEXT NOT NULL,
                content TEXT NOT NULL,
                created_at TEXT NOT NULL,
                FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE
            );

            CREATE TABLE IF NOT EXISTS mcp_servers (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                package TEXT DEFAULT '',
                install_type TEXT DEFAULT 'npm',
                command TEXT DEFAULT '',
                args TEXT DEFAULT '[]',
                env_vars TEXT DEFAULT '{}',
                enabled INTEGER DEFAULT 1,
                status TEXT DEFAULT 'not_installed',
                tools TEXT DEFAULT '[]',
                logs TEXT DEFAULT '[]',
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            );
        """)
        self.conn.commit()

    def close(self):
        """Close database connection."""
        self.conn.close()


# Global database instance
_db: Optional[Database] = None


def get_db() -> Database:
    """Get or create database instance."""
    global _db
    if _db is None:
        _db = Database()
    return _db


def init_db(db_path: str = DB_PATH) -> Database:
    """Initialize database with custom path."""
    global _db
    _db = Database(db_path)
    return _db
