-- Conversations and Messages Schema Migration
-- Version: 002
-- Date: 2026-07-09

BEGIN TRANSACTION;

-- Conversations table
CREATE TABLE IF NOT EXISTS conversations (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    provider_label TEXT,
    model_name TEXT,
    harness_id TEXT DEFAULT 'phaos',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    is_archived INTEGER DEFAULT 0,
    system_prompt TEXT
);

-- Messages table
CREATE TABLE IF NOT EXISTS messages (
    id TEXT PRIMARY KEY,
    conversation_id TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
    content TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_messages_conversation_id ON messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_conversations_updated_at ON conversations(updated_at DESC);

-- FTS for conversation title search
CREATE VIRTUAL TABLE IF NOT EXISTS conversations_fts
USING fts5(title, content=conversations);

CREATE TRIGGER IF NOT EXISTS conversations_fts_insert
AFTER INSERT ON conversations
BEGIN
    INSERT INTO conversations_fts(rowid, title)
    VALUES (new.rowid, new.title);
END;

CREATE TRIGGER IF NOT EXISTS conversations_fts_update
AFTER UPDATE ON conversations
BEGIN
    UPDATE conversations_fts
    SET title = new.title
    WHERE rowid = new.rowid;
END;

-- FTS for message content search
CREATE VIRTUAL TABLE IF NOT EXISTS messages_fts
USING fts5(content, content=messages);

CREATE TRIGGER IF NOT EXISTS messages_fts_insert
AFTER INSERT ON messages
BEGIN
    INSERT INTO messages_fts(rowid, content)
    VALUES (new.rowid, new.content);
END;

CREATE TRIGGER IF NOT EXISTS messages_fts_update
AFTER UPDATE ON messages
BEGIN
    UPDATE messages_fts
    SET content = new.content
    WHERE rowid = new.rowid;
END;

COMMIT;
