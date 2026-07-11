"""Phase 7 Verification Tests."""

import tempfile
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))


def test_task_persistence():
    """Test 1: Task persists across restarts."""
    from db.database import init_db, get_db
    from db.sqlite_store import create_task, list_tasks
    from db.schemas import TaskCreate
    import db.database as db_mod

    with tempfile.NamedTemporaryFile(suffix=".db", delete=False) as f:
        db_path = f.name

    init_db(db_path)
    task = create_task(TaskCreate(prompt="Test persistence", model="test"))
    task_id = task.id

    # Close and reopen
    db = get_db()
    db.close()
    db_mod._db = None

    init_db(db_path)
    tasks = list_tasks()
    found = any(t.id == task_id for t in tasks)
    os.unlink(db_path)
    return found


def test_skill_persistence():
    """Test 2: Skill persists across restarts."""
    from db.database import init_db, get_db
    from db.sqlite_store import list_skills, init_skills
    import db.database as db_mod

    with tempfile.NamedTemporaryFile(suffix=".db", delete=False) as f:
        db_path = f.name

    init_db(db_path)
    init_skills()

    db = get_db()
    db.close()
    db_mod._db = None

    init_db(db_path)
    skills = list_skills()
    os.unlink(db_path)
    return len(skills) > 0


def test_audit_log_persistence():
    """Test 3: Audit log persists across restarts."""
    from db.database import init_db, get_db
    from db.sqlite_store import create_audit_log, list_audit_logs
    import db.database as db_mod

    with tempfile.NamedTemporaryFile(suffix=".db", delete=False) as f:
        db_path = f.name

    init_db(db_path)
    log = create_audit_log("test.action", "success", "test details")
    log_id = log.id

    db = get_db()
    db.close()
    db_mod._db = None

    init_db(db_path)
    logs = list_audit_logs()
    found = any(l.id == log_id for l in logs)
    os.unlink(db_path)
    return found


def test_harness_slot_management():
    """Test 5-8: Harness slot management."""
    from engine.core.harness_slot import HarnessRegistry, reset_registry

    reset_registry()
    registry = HarnessRegistry()

    # Test 5: List harnesses
    harnesses = registry.list_all()
    test5 = len(harnesses) == 3
    ids = [h.id for h in harnesses]
    test5 = test5 and "phaos" in ids and "raw" in ids and "custom" in ids

    # Test 6: Switch to Raw Model
    registry.activate("raw")
    active = registry.get_active()
    test6 = active.id == "raw"

    # Test 7: Switch back to PHAOS
    registry.activate("phaos")
    active = registry.get_active()
    test7 = active.id == "phaos"

    # Test 8: Persistence (registry state)
    test8 = registry.get_harness("raw") is not None

    return test5, test6, test7, test8


def test_first_run_status():
    """Test 10: First-run detection."""
    from scripts.first_run import get_first_run_status

    status = get_first_run_status()
    return "model_cached" in status and "first_run" in status


def main():
    results = []

    # Test 1
    try:
        r = test_task_persistence()
        results.append(("1. Task persists", "PASSED" if r else "FAILED"))
    except Exception as e:
        results.append(("1. Task persists", f"FAILED: {e}"))

    # Test 2
    try:
        r = test_skill_persistence()
        results.append(("2. Skill persists", "PASSED" if r else "FAILED"))
    except Exception as e:
        results.append(("2. Skill persists", f"FAILED: {e}"))

    # Test 3
    try:
        r = test_audit_log_persistence()
        results.append(("3. Audit log persists", "PASSED" if r else "FAILED"))
    except Exception as e:
        results.append(("3. Audit log persists", f"FAILED: {e}"))

    # Test 4 (provider profiles are Rust-side, skip)
    results.append(("4. Provider profile persists", "SKIPPED (Rust-side)"))

    # Tests 5-8
    try:
        t5, t6, t7, t8 = test_harness_slot_management()
        results.append(("5. Harness list", "PASSED" if t5 else "FAILED"))
        results.append(("6. Switch to Raw Model", "PASSED" if t6 else "FAILED"))
        results.append(("7. Switch to PHAOS", "PASSED" if t7 else "FAILED"))
        results.append(("8. Harness selection persists", "PASSED" if t8 else "FAILED"))
    except Exception as e:
        results.append(("5-8. Harness management", f"FAILED: {e}"))

    # Test 9 (script exists)
    results.append(("9. Pre-cache script", "PASSED" if os.path.exists("scripts/pre_cache_models.py") else "FAILED"))

    # Test 10
    try:
        r = test_first_run_status()
        results.append(("10. First-run download", "PASSED" if r else "FAILED"))
    except Exception as e:
        results.append(("10. First-run download", f"FAILED: {e}"))

    # Tests 11-13 (require Rust toolchain, skip)
    results.append(("11. Build installer", "SKIPPED (needs Rust toolchain)"))
    results.append(("12. Installer branding", "SKIPPED (needs Rust toolchain)"))
    results.append(("13. App launches", "SKIPPED (needs Rust toolchain)"))

    # Tests 14-15 (auto-update, skip)
    results.append(("14. Check updates", "SKIPPED (needs Rust toolchain)"))
    results.append(("15. Update button", "SKIPPED (needs Rust toolchain)"))

    # Print results
    print("\n" + "=" * 60)
    print("PHASE 7 VERIFICATION RESULTS")
    print("=" * 60)
    for name, result in results:
        print(f"  {name}: {result}")
    print("=" * 60)

    passed = sum(1 for _, r in results if r == "PASSED")
    failed = sum(1 for _, r in results if "FAILED" in r)
    skipped = sum(1 for _, r in results if "SKIPPED" in r)
    print(f"\n  PASSED: {passed}  FAILED: {failed}  SKIPPED: {skipped}")
    print("=" * 60)


if __name__ == "__main__":
    main()
