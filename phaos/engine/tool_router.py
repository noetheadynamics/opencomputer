import logging
import time
from dataclasses import dataclass, field
from typing import Any, Callable

logger = logging.getLogger(__name__)

@dataclass
class ToolDefinition:
    name: str
    description: str
    parameters: dict[str, Any] = field(default_factory=dict)
    risk_level: str = "low"  # low, medium, high
    requires_approval: bool = False
    sandbox_required: bool = True

@dataclass
class ToolResult:
    success: bool
    output: Any = None
    error: str | None = None
    duration: float = 0.0
    tool_name: str = ""

class ToolRegistry:
    def __init__(self):
        self._tools: dict[str, ToolDefinition] = {}
        self._executors: dict[str, Callable] = {}
        self._approval_pending: dict[str, dict] = {}
    
    def register(self, tool: ToolDefinition, executor: Callable[[dict], Any]) -> None:
        self._tools[tool.name] = tool
        self._executors[tool.name] = executor
        logger.info(f"Registered tool: {tool.name} (risk={tool.risk_level})")
    
    def get_tool(self, name: str) -> ToolDefinition | None:
        return self._tools.get(name)
    
    def list_tools(self) -> list[ToolDefinition]:
        return list(self._tools.values())
    
    def get_definitions_for_llm(self) -> list[dict]:
        return [{"type": "function", "function": {"name": t.name, "description": t.description, "parameters": t.parameters}} for t in self._tools.values()]
    
    def requires_approval(self, tool_name: str, args: dict) -> bool:
        tool = self._tools.get(tool_name)
        if not tool:
            return False
        if tool.requires_approval:
            return True
        if tool.risk_level == "high":
            return True
        if tool.risk_level == "medium" and self._is_destructive(tool_name, args):
            return True
        return False
    
    def _is_destructive(self, tool_name: str, args: dict) -> bool:
        destructive_commands = {"rm", "delete", "drop", "truncate", "destroy", "remove", "kill", "format"}
        if tool_name in ("terminal", "execute_command", "run_command"):
            cmd = args.get("command", args.get("cmd", "")).lower()
            parts = cmd.split()
            if parts and parts[0] in destructive_commands:
                return True
            if "rm " in cmd and (" -rf " in cmd or " -r " in cmd):
                return True
        if tool_name in ("file_write", "write_file", "write"):
            return False  # writes are allowed but logged
        return False
    
    def request_approval(self, tool_name: str, args: dict) -> str:
        import uuid
        request_id = uuid.uuid4().hex[:8]
        self._approval_pending[request_id] = {"tool_name": tool_name, "args": args, "status": "pending"}
        return request_id
    
    def approve(self, request_id: str) -> bool:
        req = self._approval_pending.get(request_id)
        if not req:
            return False
        req["status"] = "approved"
        return True
    
    def deny(self, request_id: str) -> bool:
        req = self._approval_pending.get(request_id)
        if not req:
            return False
        req["status"] = "denied"
        return True
    
    def execute(self, tool_name: str, args: dict) -> ToolResult:
        tool = self._tools.get(tool_name)
        if not tool:
            return ToolResult(success=False, error=f"Unknown tool: {tool_name}", tool_name=tool_name)
        
        if tool_name not in self._executors:
            return ToolResult(success=False, error=f"No executor for tool: {tool_name}", tool_name=tool_name)
        
        start = time.time()
        try:
            output = self._executors[tool_name](args)
            return ToolResult(success=True, output=output, duration=time.time() - start, tool_name=tool_name)
        except Exception as e:
            return ToolResult(success=False, error=str(e), duration=time.time() - start, tool_name=tool_name)


class SandboxedExecutor:
    """Executes tool calls with sandbox restrictions."""
    
    BLOCKED_NETWORK_TOOLS = {"curl", "wget", "telnet", "nc", "netcat", "ssh", "scp", "rsync"}
    
    def __init__(self, workspace_root: str | None = None):
        import os
        self.workspace_root = workspace_root or os.getenv("PHAOS_WORKSPACE", os.getcwd())
        self.registry = ToolRegistry()
        self._register_builtins()
    
    def _register_builtins(self):
        self.registry.register(
            ToolDefinition(name="terminal", description="Execute a terminal command", parameters={"type": "object", "properties": {"command": {"type": "string"}}, "required": ["command"]}, risk_level="medium"),
            self._exec_terminal
        )
        self.registry.register(
            ToolDefinition(name="file_read", description="Read file contents", parameters={"type": "object", "properties": {"path": {"type": "string"}}, "required": ["path"]}, risk_level="low"),
            self._exec_file_read
        )
        self.registry.register(
            ToolDefinition(name="file_write", description="Write file contents", parameters={"type": "object", "properties": {"path": {"type": "string"}, "content": {"type": "string"}}, "required": ["path", "content"]}, risk_level="medium", requires_approval=True),
            self._exec_file_write
        )
        self.registry.register(
            ToolDefinition(name="git", description="Run git commands", parameters={"type": "object", "properties": {"command": {"type": "string"}}, "required": ["command"]}, risk_level="medium", requires_approval=True),
            self._exec_git
        )
        self.registry.register(
            ToolDefinition(name="think", description="Internal reasoning step", parameters={"type": "object", "properties": {"thought": {"type": "string"}}, "required": ["thought"]}, risk_level="low", sandbox_required=False),
            self._exec_think
        )
        self.registry.register(
            ToolDefinition(name="done", description="Signal task completion", parameters={"type": "object", "properties": {"response": {"type": "string"}}, "required": ["response"]}, risk_level="low", sandbox_required=False),
            self._exec_done
        )
        self._register_compact_tools()
    
    def _exec_terminal(self, args: dict) -> Any:
        import subprocess, shlex, sys
        cmd = args.get("command", "")
        if not cmd:
            raise ValueError("No command provided")
        first_word = cmd.split()[0] if cmd.split() else ""
        if first_word in self.BLOCKED_NETWORK_TOOLS:
            raise PermissionError(f"Network command '{first_word}' is blocked by sandbox")
        if sys.platform == "win32":
            result = subprocess.run(cmd, shell=True, capture_output=True, text=True, timeout=30, cwd=self.workspace_root)
        else:
            cmd_parts = shlex.split(cmd)
            result = subprocess.run(cmd_parts, shell=False, capture_output=True, text=True, timeout=30, cwd=self.workspace_root)
        return {"stdout": result.stdout, "stderr": result.stderr, "returncode": result.returncode}
    
    def _exec_file_read(self, args: dict) -> str:
        import os
        path = args.get("path", "")
        if ".." in path:
            raise ValueError("Path traversal not allowed")
        full_path = os.path.join(self.workspace_root, path)
        with open(full_path, "r") as f:
            return f.read()
    
    def _exec_file_write(self, args: dict) -> str:
        import os
        path = args.get("path", "")
        content = args.get("content", "")
        if ".." in path:
            raise ValueError("Path traversal not allowed")
        full_path = os.path.join(self.workspace_root, path)
        os.makedirs(os.path.dirname(full_path), exist_ok=True)
        with open(full_path, "w") as f:
            f.write(content)
        return f"Written {len(content)} bytes to {path}"
    
    def _exec_git(self, args: dict) -> Any:
        import subprocess, shlex, sys
        cmd = args.get("command", "")
        allowed_subcommands = {"status", "add", "commit", "push", "pull", "branch", "diff", "log", "checkout", "merge", "rebase"}
        parts = cmd.strip().split(None, 1)
        subcommand = parts[0] if parts else ""
        if subcommand not in allowed_subcommands:
            raise PermissionError(f"Git subcommand '{subcommand}' is not allowed. Allowed: {sorted(allowed_subcommands)}")
        if sys.platform == "win32":
            full_cmd = f"git {cmd}"
            result = subprocess.run(full_cmd, shell=True, capture_output=True, text=True, timeout=30, cwd=self.workspace_root)
        else:
            cmd_parts = ["git"] + shlex.split(cmd)
            result = subprocess.run(cmd_parts, shell=False, capture_output=True, text=True, timeout=30, cwd=self.workspace_root)
        return {"stdout": result.stdout, "stderr": result.stderr, "returncode": result.returncode}
    
    def _exec_think(self, args: dict) -> str:
        return args.get("thought", "")
    
    def _exec_done(self, args: dict) -> str:
        return args.get("response", "")

    def _register_compact_tools(self):
        """Register DCP compaction tools: compact, discard, protect, prune."""
        from ..core.compact_context import CompactContext, COMPACT_TOOL_DEFINITIONS
        self._compact_ctx: CompactContext | None = None
        self._messages: list[dict] = []

        def _set_context(ctx: CompactContext, messages: list[dict]):
            self._compact_ctx = ctx
            self._messages = messages

        self._set_compact_context = _set_context

        for tool_def in COMPACT_TOOL_DEFINITIONS:
            name = tool_def["function"]["name"]
            self.registry.register(
                ToolDefinition(
                    name=name,
                    description=tool_def["function"]["description"],
                    parameters=tool_def["function"]["parameters"],
                    risk_level="low",
                    sandbox_required=False,
                ),
                lambda args, _n=name: self._exec_compact_tool(_n, args),
            )

    def _exec_compact_tool(self, tool_name: str, args: dict) -> Any:
        if not self._compact_ctx:
            return {"error": "No compact context set"}
        if not self._messages:
            return {"error": "No messages loaded"}

        if tool_name == "compact":
            result = self._compact_ctx.compact(
                self._messages,
                start=args.get("start", 0),
                end=args.get("end", len(self._messages)),
                summary=args.get("summary", ""),
            )
            self._messages.clear()
            self._messages.extend(result)
            return {"success": True, "new_count": len(result)}

        elif tool_name == "discard":
            result = self._compact_ctx.discard(self._messages, args.get("message_ids", []))
            self._messages.clear()
            self._messages.extend(result)
            return {"success": True, "new_count": len(result)}

        elif tool_name == "protect":
            self._compact_ctx.protect(self._messages, args.get("message_ids", []))
            return {"success": True, "protected": args.get("message_ids", [])}

        elif tool_name == "prune":
            result = self._compact_ctx.prune(self._messages, args.get("tool_call_ids", []))
            self._messages.clear()
            self._messages.extend(result)
            return {"success": True, "new_count": len(result)}

        return {"error": f"Unknown compact tool: {tool_name}"}

    def execute_tool_call(self, tool_call) -> Any:
        from .react_loop import ToolCall, Observation
        if isinstance(tool_call, ToolCall):
            name = tool_call.name
            args = tool_call.args
        else:
            name = tool_call.get("name", "")
            args = tool_call.get("args", {})
        
        if self.registry.requires_approval(name, args):
            req_id = self.registry.request_approval(name, args)
            logger.warning(f"Tool '{name}' requires approval (request_id={req_id})")
            return {"status": "approval_required", "request_id": req_id, "tool": name}
        
        result = self.registry.execute(name, args)
        return {"success": result.success, "output": result.output, "error": result.error}
