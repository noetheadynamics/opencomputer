"""Tests for PHAOS SQLite database implementation."""

import pytest
import tempfile
import os
import sys
from datetime import datetime, timezone

# Add parent directory to path for imports
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from db.database import Database, init_db, get_db
from db.sqlite_store import (
    create_task,
    get_task,
    list_tasks,
    update_task,
    list_slots,
    acquire_slot,
    release_slot,
    init_slots,
    list_skills,
    get_skill,
    init_skills,
    create_audit_log,
    list_audit_logs,
    create_cron_job,
    list_cron_jobs,
    delete_cron_job,
    list_harness_configs,
    get_active_harness,
    activate_harness,
    init_harness_configs,
)
from db.schemas import TaskCreate, TaskStatus, SlotStatus


@pytest.fixture(autouse=True)
def temp_db():
    """Create a temporary database for testing."""
    import phaos.db.database as db_mod
    import phaos.db.sqlite_store as store_mod
    
    with tempfile.NamedTemporaryFile(suffix=".db", delete=False) as f:
        db_path = f.name
    
    init_db(db_path)
    yield db_path
    
    # Close DB connection before cleanup
    db = get_db()
    db.close()
    db_mod._db = None
    try:
        os.unlink(db_path)
    except PermissionError:
        pass


class TestDatabase:
    """Tests for Database class."""

    def test_init_database(self, temp_db):
        """Test database initialization."""
        db = get_db()
        assert db is not None
        assert os.path.exists(temp_db)

    def test_create_tables(self, temp_db):
        """Test table creation."""
        db = get_db()
        cursor = db.conn.cursor()
        
        # Check tables exist
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table'")
        tables = [row[0] for row in cursor.fetchall()]
        
        assert "tasks" in tables
        assert "harness_slots" in tables
        assert "skills" in tables
        assert "audit_logs" in tables
        assert "cron_jobs" in tables
        assert "harness_configs" in tables


class TestTasks:
    """Tests for task operations."""

    def test_create_task(self, temp_db):
        """Test task creation."""
        req = TaskCreate(prompt="Test task", model="test-model")
        task = create_task(req)
        
        assert task.id is not None
        assert task.prompt == "Test task"
        assert task.model == "test-model"
        assert task.status == TaskStatus.PENDING

    def test_get_task(self, temp_db):
        """Test getting a task."""
        req = TaskCreate(prompt="Test task", model="test-model")
        task = create_task(req)
        
        retrieved = get_task(task.id)
        assert retrieved is not None
        assert retrieved.id == task.id
        assert retrieved.prompt == "Test task"

    def test_list_tasks(self, temp_db):
        """Test listing tasks."""
        # Create multiple tasks
        for i in range(3):
            create_task(TaskCreate(prompt=f"Task {i}", model="model"))
        
        tasks = list_tasks()
        assert len(tasks) == 3

    def test_update_task(self, temp_db):
        """Test updating a task."""
        req = TaskCreate(prompt="Test task", model="test-model")
        task = create_task(req)
        
        updated = update_task(task.id, status=TaskStatus.COMPLETED, result="Done")
        assert updated is not None
        assert updated.status == TaskStatus.COMPLETED
        assert updated.result == "Done"


class TestHarnessSlots:
    """Tests for harness slot operations."""

    def test_init_slots(self, temp_db):
        """Test slot initialization."""
        init_slots()
        slots = list_slots()
        assert len(slots) == 4

    def test_acquire_slot(self, temp_db):
        """Test acquiring a slot."""
        init_slots()
        req = TaskCreate(prompt="Test task", model="test-model")
        task = create_task(req)
        slot = acquire_slot("slot-0", task.id)
        
        assert slot is not None
        assert slot.status == SlotStatus.OCCUPIED
        assert slot.owner_task_id == task.id

    def test_release_slot(self, temp_db):
        """Test releasing a slot."""
        init_slots()
        req = TaskCreate(prompt="Test task", model="test-model")
        task = create_task(req)
        acquire_slot("slot-0", task.id)
        released = release_slot("slot-0")
        
        assert released is not None
        assert released.status == SlotStatus.AVAILABLE
        assert released.owner_task_id is None

    def test_acquire_occupied_slot(self, temp_db):
        """Test acquiring an already occupied slot."""
        init_slots()
        req1 = TaskCreate(prompt="Task 1", model="test-model")
        task1 = create_task(req1)
        req2 = TaskCreate(prompt="Task 2", model="test-model")
        task2 = create_task(req2)
        acquire_slot("slot-0", task1.id)
        result = acquire_slot("slot-0", task2.id)
        
        assert result is None


class TestSkills:
    """Tests for skill operations."""

    def test_init_skills(self, temp_db):
        """Test skill initialization."""
        init_skills()
        skills = list_skills()
        assert len(skills) == 3

    def test_get_skill(self, temp_db):
        """Test getting a skill."""
        init_skills()
        skill = get_skill("skill-run-command")
        
        assert skill is not None
        assert skill.name == "Run Command"
        assert skill.command == "{command}"


class TestAuditLogs:
    """Tests for audit log operations."""

    def test_create_audit_log(self, temp_db):
        """Test audit log creation."""
        log = create_audit_log("test.action", "success", "Test details")
        
        assert log.id is not None
        assert log.action == "test.action"
        assert log.outcome == "success"
        assert log.details == "Test details"

    def test_list_audit_logs(self, temp_db):
        """Test listing audit logs."""
        for i in range(5):
            create_audit_log(f"action.{i}", "success")
        
        logs = list_audit_logs()
        assert len(logs) == 5

    def test_list_audit_logs_with_filter(self, temp_db):
        """Test listing audit logs with filters."""
        create_audit_log("action.a", "success")
        create_audit_log("action.b", "failure")
        create_audit_log("action.a", "success")
        
        logs = list_audit_logs(action="action.a")
        assert len(logs) == 2
        
        logs = list_audit_logs(outcome="failure")
        assert len(logs) == 1


class TestCronJobs:
    """Tests for cron job operations."""

    def test_create_cron_job(self, temp_db):
        """Test cron job creation."""
        job = create_cron_job("Test Job", "0 * * * *", "echo test")
        
        assert job.id is not None
        assert job.name == "Test Job"
        assert job.schedule == "0 * * * *"
        assert job.enabled is True

    def test_list_cron_jobs(self, temp_db):
        """Test listing cron jobs."""
        for i in range(3):
            create_cron_job(f"Job {i}", f"{i} * * * *", f"echo {i}")
        
        jobs = list_cron_jobs()
        assert len(jobs) == 3

    def test_delete_cron_job(self, temp_db):
        """Test deleting a cron job."""
        job = create_cron_job("Test Job", "0 * * * *", "echo test")
        result = delete_cron_job(job.id)
        
        assert result is True
        assert len(list_cron_jobs()) == 0


class TestHarnessConfigs:
    """Tests for harness configuration operations."""

    def test_init_harness_configs(self, temp_db):
        """Test harness config initialization."""
        init_harness_configs()
        configs = list_harness_configs()
        assert len(configs) == 3

    def test_get_active_harness(self, temp_db):
        """Test getting active harness."""
        init_harness_configs()
        active = get_active_harness()
        
        assert active is not None
        assert active["id"] == "phaos"
        assert active["is_active"] is True

    def test_activate_harness(self, temp_db):
        """Test activating a harness."""
        init_harness_configs()
        result = activate_harness("raw")
        
        assert result is True
        active = get_active_harness()
        assert active["id"] == "raw"
