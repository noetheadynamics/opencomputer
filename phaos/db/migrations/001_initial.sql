-- PHAOS Initial Schema Migration
-- Version: 001
-- Date: 2026-07-09

BEGIN TRANSACTION;

-- Tasks table
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

-- Harness slots table
CREATE TABLE IF NOT EXISTS harness_slots (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    status TEXT NOT NULL,
    owner_task_id TEXT,
    metadata TEXT DEFAULT '{}',
    FOREIGN KEY (owner_task_id) REFERENCES tasks(id)
);

-- Skills table
CREATE TABLE IF NOT EXISTS skills (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT NOT NULL,
    command TEXT NOT NULL,
    enabled INTEGER DEFAULT 1
);

-- Audit logs table
CREATE TABLE IF NOT EXISTS audit_logs (
    id TEXT PRIMARY KEY,
    action TEXT NOT NULL,
    outcome TEXT NOT NULL,
    details TEXT,
    timestamp TEXT NOT NULL
);

-- Cron jobs table
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

-- Harness configurations table
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

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
CREATE INDEX IF NOT EXISTS idx_tasks_created_at ON tasks(created_at);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_timestamp ON audit_logs(timestamp);
CREATE INDEX IF NOT EXISTS idx_cron_jobs_enabled ON cron_jobs(enabled);

COMMIT;
