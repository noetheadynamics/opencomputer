"""PHAOS CLI entry point — `python -m phaos`."""

import argparse
import sys


def main():
    parser = argparse.ArgumentParser(description="PHAOS — OpenComputer agent backend")
    sub = parser.add_subparsers(dest="command")

    # serve
    serve_parser = sub.add_parser("serve", help="Start the PHAOS FastAPI server")
    serve_parser.add_argument("--host", default="127.0.0.1")
    serve_parser.add_argument("--port", type=int, default=8420)
    serve_parser.add_argument("--reload", action="store_true")

    # health
    sub.add_parser("health", help="Check if PHAOS is running")

    # run-task
    run_parser = sub.add_parser("run-task", help="Execute a task through the ReAct pipeline")
    run_parser.add_argument("prompt", help="Task prompt")
    run_parser.add_argument("--model", default="local-default", help="Model to use")
    run_parser.add_argument("--verbose", "-v", action="store_true")

    # engine-status
    sub.add_parser("engine-status", help="Show orchestrator engine status")

    args = parser.parse_args()

    if args.command == "serve":
        import uvicorn
        uvicorn.run(
            "phaos.main:app",
            host=args.host,
            port=args.port,
            reload=args.reload,
        )
    elif args.command == "health":
        try:
            import httpx
        except ImportError:
            print("httpx is not installed. Install with: pip install httpx")
            sys.exit(1)
        try:
            r = httpx.get("http://127.0.0.1:8420/health")
            print(r.json())
        except httpx.ConnectError:
            print("PHAOS is not running.")
            sys.exit(1)
    elif args.command == "run-task":
        _run_task(args.prompt, args.model, args.verbose)
    elif args.command == "engine-status":
        _engine_status()
    else:
        parser.print_help()


def _run_task(prompt: str, model: str, verbose: bool):
    """Execute a task through the ReAct pipeline."""
    import uuid
    from phaos.engine.orchestrator import LayeredOrchestrator, TaskContext

    task_id = uuid.uuid4().hex[:12]
    print(f"Task {task_id}: {prompt[:80]}...")

    orchestrator = LayeredOrchestrator()
    task = TaskContext(task_id=task_id, prompt=prompt, model=model)

    result = orchestrator.execute(task)

    print(f"\nStatus: {result.status}")
    print(f"Category: {result.category}")
    print(f"Iterations: {result.iterations}")
    print(f"Time: {result.total_time:.2f}s")
    if result.amplifications_applied:
        print(f"Amplifications: {', '.join(result.amplifications_applied)}")
    print(f"\nResponse:\n{result.response}")

    if verbose and result.error:
        print(f"\nError: {result.error}")


def _engine_status():
    """Show orchestrator engine status."""
    from phaos.engine.orchestrator import LayeredOrchestrator

    orch = LayeredOrchestrator()
    status = orch.get_status()
    print("PHAOS Engine Status:")
    print(f"  Active tasks: {status['active_tasks']}")
    print(f"  Alethea: {status['alethea']}")
    print(f"  AV2: {status['av2']}")
    print(f"  Error recovery: {status['error_recovery']}")


if __name__ == "__main__":
    main()
