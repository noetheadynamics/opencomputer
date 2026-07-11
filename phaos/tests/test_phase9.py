"""Tests for Phase 9: Conversations, Messages, Chat History."""

import pytest
import tempfile
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from db.database import init_db, get_db
from db.conversation_store import (
    create_conversation,
    get_conversation,
    list_conversations,
    update_conversation,
    delete_conversation,
    search_conversations,
    create_message,
    get_messages,
    get_message,
    update_message,
    delete_message,
    get_last_message,
    search_messages,
)


# ── Conversation Tests ────────────────────────────────────────────────


class TestConversations:
    """Tests for conversation CRUD."""

    @pytest.fixture(autouse=True)
    def setup(self):
        self._db_fd, db_path = tempfile.mkstemp(suffix=".db")
        os.close(self._db_fd)
        init_db(db_path)
        yield
        try:
            os.unlink(db_path)
        except PermissionError:
            pass

    def test_create_conversation(self):
        conv = create_conversation("Test Chat")
        assert conv["id"] is not None
        assert conv["title"] == "Test Chat"
        assert conv["harness_id"] == "phaos"

    def test_get_conversation(self):
        conv = create_conversation("Get Test")
        retrieved = get_conversation(conv["id"])
        assert retrieved is not None
        assert retrieved["title"] == "Get Test"

    def test_list_conversations(self):
        for i in range(3):
            create_conversation(f"Chat {i}")
        convs = list_conversations()
        assert len(convs) == 3

    def test_update_conversation(self):
        conv = create_conversation("Original")
        updated = update_conversation(conv["id"], title="Updated")
        assert updated["title"] == "Updated"

    def test_delete_conversation(self):
        conv = create_conversation("To Delete")
        result = delete_conversation(conv["id"])
        assert result is True
        assert get_conversation(conv["id"]) is None

    def test_search_conversations(self):
        create_conversation("Python Tutorial")
        create_conversation("JavaScript Guide")
        create_conversation("Rust Basics")
        results = search_conversations("Python")
        assert len(results) >= 1
        assert any("Python" in r["title"] for r in results)

    def test_conversation_with_metadata(self):
        conv = create_conversation(
            "Custom",
            provider_label="OpenAI",
            model_name="gpt-4",
            system_prompt="You are helpful.",
        )
        assert conv["provider_label"] == "OpenAI"
        assert conv["model_name"] == "gpt-4"
        assert conv["system_prompt"] == "You are helpful."


# ── Message Tests ─────────────────────────────────────────────────────


class TestMessages:
    """Tests for message CRUD."""

    @pytest.fixture(autouse=True)
    def setup(self):
        self._db_fd, db_path = tempfile.mkstemp(suffix=".db")
        os.close(self._db_fd)
        init_db(db_path)
        self.conv = create_conversation("Test Conv")
        yield
        try:
            os.unlink(db_path)
        except PermissionError:
            pass

    def test_create_message(self):
        msg = create_message(self.conv["id"], "user", "Hello")
        assert msg["id"] is not None
        assert msg["role"] == "user"
        assert msg["content"] == "Hello"

    def test_get_messages(self):
        create_message(self.conv["id"], "user", "Hi")
        create_message(self.conv["id"], "assistant", "Hello!")
        messages = get_messages(self.conv["id"])
        assert len(messages) == 2
        assert messages[0]["role"] == "user"
        assert messages[1]["role"] == "assistant"

    def test_get_message(self):
        msg = create_message(self.conv["id"], "user", "Test")
        retrieved = get_message(msg["id"])
        assert retrieved is not None
        assert retrieved["content"] == "Test"

    def test_update_message(self):
        msg = create_message(self.conv["id"], "user", "Original")
        updated = update_message(msg["id"], "Updated content")
        assert updated["content"] == "Updated content"

    def test_delete_message(self):
        msg = create_message(self.conv["id"], "user", "To delete")
        result = delete_message(msg["id"])
        assert result is True
        assert get_message(msg["id"]) is None

    def test_get_last_message(self):
        create_message(self.conv["id"], "user", "First")
        create_message(self.conv["id"], "assistant", "Second")
        create_message(self.conv["id"], "user", "Third")
        last = get_last_message(self.conv["id"])
        assert last["content"] == "Third"

    def test_search_messages(self):
        create_message(self.conv["id"], "user", "How to use Python lists")
        create_message(self.conv["id"], "assistant", "Python lists are mutable sequences")
        results = search_messages("Python")
        assert len(results) >= 1

    def test_message_updates_conversation_timestamp(self):
        create_message(self.conv["id"], "user", "Hello")
        conv = get_conversation(self.conv["id"])
        # updated_at should be set
        assert conv["updated_at"] is not None


# ── Integration Tests ─────────────────────────────────────────────────


class TestConversationIntegration:
    """Integration tests for full conversation flow."""

    @pytest.fixture(autouse=True)
    def setup(self):
        self._db_fd, db_path = tempfile.mkstemp(suffix=".db")
        os.close(self._db_fd)
        init_db(db_path)
        yield
        try:
            os.unlink(db_path)
        except PermissionError:
            pass

    def test_full_conversation_flow(self):
        # Create conversation
        conv = create_conversation("Integration Test", system_prompt="Be helpful.")
        assert conv["id"] is not None

        # Add messages
        msg1 = create_message(conv["id"], "user", "What is 2+2?")
        msg2 = create_message(conv["id"], "assistant", "4")
        msg3 = create_message(conv["id"], "user", "Thanks!")

        # Get all messages
        messages = get_messages(conv["id"])
        assert len(messages) == 3

        # Search
        results = search_messages("2+2")
        assert len(results) >= 1

        # Update conversation
        updated = update_conversation(conv["id"], title="Math Chat")
        assert updated["title"] == "Math Chat"

        # Delete conversation
        delete_conversation(conv["id"])
        assert get_conversation(conv["id"]) is None
        assert len(get_messages(conv["id"])) == 0
