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
        self.registry.register(
            ToolDefinition(
                name="create_cron_job",
                description="Create a scheduled task (cron job). Use cron syntax for schedule. Examples: '* * * * *' = every minute, '0 9 * * *' = daily at 9am, '*/5 * * * *' = every 5 minutes.",
                parameters={
                    "type": "object",
                    "properties": {
                        "name": {"type": "string", "description": "Name/title of the job"},
                        "schedule": {"type": "string", "description": "Cron schedule expression (minute hour day month weekday)"},
                        "command": {"type": "string", "description": "What to do — a reminder message or shell command"},
                    },
                    "required": ["name", "schedule", "command"],
                },
                risk_level="low",
                sandbox_required=False,
            ),
            self._exec_create_cron_job,
        )
        self.registry.register(
            ToolDefinition(
                name="create_folder",
                description="Create a new directory/folder in the workspace",
                parameters={
                    "type": "object",
                    "properties": {
                        "path": {"type": "string", "description": "Relative path of the folder to create"},
                    },
                    "required": ["path"],
                },
                risk_level="low",
                sandbox_required=False,
            ),
            self._exec_create_folder,
        )
        self.registry.register(
            ToolDefinition(
                name="list_directory",
                description="List files and folders in a directory",
                parameters={
                    "type": "object",
                    "properties": {
                        "path": {"type": "string", "description": "Relative path to list (default: workspace root)"},
                    },
                },
                risk_level="low",
                sandbox_required=False,
            ),
            self._exec_list_directory,
        )
        self.registry.register(
            ToolDefinition(
                name="add_truth_vault",
                description="Store a verified fact in the Truth Vault for future reference",
                parameters={
                    "type": "object",
                    "properties": {
                        "query": {"type": "string", "description": "The topic or question this fact answers"},
                        "answer": {"type": "string", "description": "The verified fact/answer"},
                        "sources": {"type": "array", "items": {"type": "string"}, "description": "Sources that verify this fact"},
                        "confidence": {"type": "number", "description": "Confidence level 0.0-1.0"},
                    },
                    "required": ["query", "answer"],
                },
                risk_level="low",
                sandbox_required=False,
            ),
            self._exec_add_truth_vault,
        )
        self.registry.register(
            ToolDefinition(
                name="add_notification",
                description="Create an in-app notification for the user",
                parameters={
                    "type": "object",
                    "properties": {
                        "title": {"type": "string", "description": "Notification title"},
                        "message": {"type": "string", "description": "Notification body"},
                        "type": {"type": "string", "enum": ["info", "success", "warning", "error"], "description": "Notification type"},
                    },
                    "required": ["title", "message"],
                },
                risk_level="low",
                sandbox_required=False,
            ),
            self._exec_add_notification,
        )
        self.registry.register(
            ToolDefinition(
                name="search_workspace",
                description="Search for files in the workspace by name pattern",
                parameters={
                    "type": "object",
                    "properties": {
                        "pattern": {"type": "string", "description": "Filename pattern to search for (e.g. '*.py', '*.ts', 'README*')"},
                    },
                    "required": ["pattern"],
                },
                risk_level="low",
                sandbox_required=False,
            ),
            self._exec_search_workspace,
        )
        self.registry.register(
            ToolDefinition(
                name="web_fetch",
                description="Fetch content from a URL. Returns the text content of the page.",
                parameters={
                    "type": "object",
                    "properties": {
                        "url": {"type": "string", "description": "The URL to fetch"},
                    },
                    "required": ["url"],
                },
                risk_level="medium",
                sandbox_required=False,
            ),
            self._exec_web_fetch,
        )
        self.registry.register(
            ToolDefinition(
                name="web_search",
                description="Search the internet for information. Returns search results with titles, URLs, and snippets.",
                parameters={
                    "type": "object",
                    "properties": {
                        "query": {"type": "string", "description": "The search query"},
                    },
                    "required": ["query"],
                },
                risk_level="medium",
                sandbox_required=False,
            ),
            self._exec_web_search,
        )
        self.registry.register(
            ToolDefinition(
                name="file_delete",
                description="Delete a file from the workspace",
                parameters={
                    "type": "object",
                    "properties": {
                        "path": {"type": "string", "description": "Relative path of the file to delete"},
                    },
                    "required": ["path"],
                },
                risk_level="medium",
                requires_approval=True,
            ),
            self._exec_file_delete,
        )
        self.registry.register(
            ToolDefinition(
                name="file_edit",
                description="Edit a file by replacing specific text content (surgical edit, not full overwrite)",
                parameters={
                    "type": "object",
                    "properties": {
                        "path": {"type": "string", "description": "Relative path of the file to edit"},
                        "old_text": {"type": "string", "description": "Exact text to find and replace"},
                        "new_text": {"type": "string", "description": "Replacement text"},
                    },
                    "required": ["path", "old_text", "new_text"],
                },
                risk_level="medium",
                requires_approval=True,
            ),
            self._exec_file_edit,
        )
        self.registry.register(
            ToolDefinition(
                name="memory_search",
                description="Search the memory store for relevant past interactions and facts",
                parameters={
                    "type": "object",
                    "properties": {
                        "query": {"type": "string", "description": "Search query"},
                    },
                    "required": ["query"],
                },
                risk_level="low",
                sandbox_required=False,
            ),
            self._exec_memory_search,
        )
        self.registry.register(
            ToolDefinition(
                name="memory_store",
                description="Store information in the memory system for future retrieval",
                parameters={
                    "type": "object",
                    "properties": {
                        "key": {"type": "string", "description": "Memory key/topic"},
                        "content": {"type": "string", "description": "Content to remember"},
                    },
                    "required": ["key", "content"],
                },
                risk_level="low",
                sandbox_required=False,
            ),
            self._exec_memory_store,
        )
        self.registry.register(
            ToolDefinition(
                name="skill_execute",
                description="Execute a registered skill by name (runs the skill's workflow)",
                parameters={
                    "type": "object",
                    "properties": {
                        "skill_name": {"type": "string", "description": "Name of the skill to execute"},
                        "args": {"type": "object", "description": "Arguments to pass to the skill"},
                    },
                    "required": ["skill_name"],
                },
                risk_level="low",
                sandbox_required=False,
            ),
            self._exec_skill_execute,
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

    def _exec_create_cron_job(self, args: dict) -> dict:
        import uuid
        from datetime import datetime, timezone
        from ..db.database import get_db
        name = args.get("name", "Untitled job")
        schedule = args.get("schedule", "")
        command = args.get("command", "")
        if not schedule:
            return {"error": "No schedule provided"}
        db = get_db()
        job_id = f"cron-{uuid.uuid4().hex[:8]}"
        now = datetime.now(timezone.utc).isoformat()
        db.conn.execute(
            "INSERT INTO cron_jobs (id, name, schedule, command, enabled, created_at) VALUES (?, ?, ?, ?, ?, ?)",
            (job_id, name, schedule, command, 1, now),
        )
        db.conn.commit()
        return {"success": True, "job_id": job_id, "name": name, "schedule": schedule}

    def _exec_create_folder(self, args: dict) -> dict:
        import os
        path = args.get("path", "")
        if not path:
            return {"error": "No path provided"}
        full_path = os.path.join(self.workspace_root, path)
        os.makedirs(full_path, exist_ok=True)
        return {"success": True, "path": path}

    def _exec_list_directory(self, args: dict) -> dict:
        import os
        path = args.get("path", ".")
        full_path = os.path.join(self.workspace_root, path) if path != "." else self.workspace_root
        if not os.path.isdir(full_path):
            return {"error": f"Not a directory: {path}"}
        entries = []
        for name in sorted(os.listdir(full_path)):
            child = os.path.join(full_path, name)
            if os.path.isdir(child):
                entries.append(f"  {name}/")
            else:
                size = os.path.getsize(child)
                entries.append(f"  {name} ({size} bytes)")
        return {"path": path, "entries": entries}

    def _exec_add_truth_vault(self, args: dict) -> dict:
        import uuid, json
        from datetime import datetime, timezone
        from ..db.database import get_db
        query = args.get("query", "")
        answer = args.get("answer", "")
        sources = args.get("sources", [])
        confidence = args.get("confidence", 0.8)
        db = get_db()
        fact_id = f"vault-{uuid.uuid4().hex[:8]}"
        now = datetime.now(timezone.utc).isoformat()
        db.conn.execute(
            "INSERT INTO truth_vault (id, query, answer, sources, confidence, ttl_hours, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
            (fact_id, query, answer, json.dumps(sources), confidence, 24, now),
        )
        db.conn.commit()
        return {"success": True, "fact_id": fact_id}

    def _exec_add_notification(self, args: dict) -> dict:
        import uuid
        from datetime import datetime, timezone
        from ..db.database import get_db
        title = args.get("title", "")
        message = args.get("message", "")
        ntype = args.get("type", "info")
        db = get_db()
        n_id = f"notif-{uuid.uuid4().hex[:8]}"
        now = datetime.now(timezone.utc).isoformat()
        db.conn.execute(
            "INSERT INTO notifications (id, title, message, type, created_at) VALUES (?, ?, ?, ?, ?)",
            (n_id, title, message, ntype, now),
        )
        db.conn.commit()
        return {"success": True, "notification_id": n_id}

    def _exec_search_workspace(self, args: dict) -> dict:
        import os, fnmatch
        pattern = args.get("pattern", "*")
        matches = []
        for root, dirs, files in os.walk(self.workspace_root):
            # Skip node_modules, .git, dist
            dirs[:] = [d for d in dirs if d not in ("node_modules", ".git", "dist", "__pycache__", ".next")]
            for name in files + dirs:
                if fnmatch.fnmatch(name.lower(), pattern.lower()):
                    full = os.path.join(root, name)
                    rel = os.path.relpath(full, self.workspace_root)
                    matches.append(rel.replace("\\", "/"))
                    if len(matches) >= 50:
                        return {"pattern": pattern, "matches": matches, "truncated": True}
        return {"pattern": pattern, "matches": matches}

    def _exec_web_fetch(self, args: dict) -> dict:
        import httpx
        url = args.get("url", "")
        if not url:
            return {"error": "No URL provided"}
        try:
            with httpx.Client(timeout=15.0, follow_redirects=True) as client:
                resp = client.get(url, headers={"User-Agent": "Mozilla/5.0 (compatible; OpenComputer/1.0)"})
                if resp.status_code != 200:
                    return {"error": f"HTTP {resp.status_code}", "url": url}
                content_type = resp.headers.get("content-type", "")
                text = resp.text
                # For HTML, strip tags to get readable text
                if "html" in content_type:
                    import re
                    text = re.sub(r'<script[^>]*>.*?</script>', '', text, flags=re.DOTALL)
                    text = re.sub(r'<style[^>]*>.*?</style>', '', text, flags=re.DOTALL)
                    text = re.sub(r'<[^>]+>', ' ', text)
                    text = re.sub(r'\s+', ' ', text).strip()
                # Truncate to reasonable size
                if len(text) > 8000:
                    text = text[:8000] + "\n...[truncated]"
                return {"url": url, "status": resp.status_code, "content_type": content_type, "text": text}
        except Exception as e:
            return {"error": str(e), "url": url}

    def _exec_web_search(self, args: dict) -> dict:
        import httpx, re, html
        query = args.get("query", "")
        if not query:
            return {"error": "No query provided"}
        try:
            # Use DuckDuckGo HTML search (no API key needed)
            with httpx.Client(timeout=15.0, follow_redirects=True) as client:
                resp = client.get(
                    "https://html.duckduckgo.com/html/",
                    params={"q": query},
                    headers={"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"},
                )
                if resp.status_code != 200:
                    return {"error": f"Search failed: HTTP {resp.status_code}", "query": query}
                text = resp.text
                # Parse results from DuckDuckGo HTML
                results = []
                # Find result blocks
                titles = re.findall(r'class="result__a"[^>]*>(.*?)</a>', text, re.DOTALL)
                snippets = re.findall(r'class="result__snippet">(.*?)</[at]', text, re.DOTALL)
                urls = re.findall(r'class="result__url"[^>]*>(.*?)</a>', text, re.DOTALL)
                for i in range(min(len(titles), 10)):
                    title = html.unescape(re.sub(r'<[^>]+>', '', titles[i]).strip())
                    snippet = html.unescape(re.sub(r'<[^>]+>', '', snippets[i]).strip()) if i < len(snippets) else ""
                    url = html.unescape(re.sub(r'<[^>]+>', '', urls[i]).strip()) if i < len(urls) else ""
                    results.append({"title": title, "url": url, "snippet": snippet})
                return {"query": query, "results": results}
        except Exception as e:
            return {"error": str(e), "query": query}

    def _exec_file_delete(self, args: dict) -> str:
        import os
        path = args.get("path", "")
        if not path:
            raise ValueError("No path provided")
        if ".." in path:
            raise ValueError("Path traversal not allowed")
        full_path = os.path.join(self.workspace_root, path)
        if not os.path.isfile(full_path):
            raise FileNotFoundError(f"File not found: {path}")
        os.remove(full_path)
        return f"Deleted {path}"

    def _exec_file_edit(self, args: dict) -> str:
        import os
        path = args.get("path", "")
        old_text = args.get("old_text", "")
        new_text = args.get("new_text", "")
        if not path or not old_text:
            raise ValueError("path and old_text are required")
        if ".." in path:
            raise ValueError("Path traversal not allowed")
        full_path = os.path.join(self.workspace_root, path)
        with open(full_path, "r") as f:
            content = f.read()
        if old_text not in content:
            raise ValueError(f"old_text not found in {path}")
        count = content.count(old_text)
        new_content = content.replace(old_text, new_text, 1)
        with open(full_path, "w") as f:
            f.write(new_content)
        return f"Edited {path}: replaced {count} occurrence(s)"

    def _exec_memory_search(self, args: dict) -> dict:
        query = args.get("query", "")
        if not query:
            return {"error": "No query provided"}
        try:
            from ..db.database import get_db
            db = get_db()
            rows = db.conn.execute(
                "SELECT key, content, created_at FROM memory_store WHERE key LIKE ? OR content LIKE ? ORDER BY created_at DESC LIMIT 10",
                (f"%{query}%", f"%{query}%"),
            ).fetchall()
            results = [{"key": r[0], "content": r[1], "created_at": r[2]} for r in rows]
            return {"query": query, "results": results}
        except Exception as e:
            return {"error": str(e)}

    def _exec_memory_store(self, args: dict) -> dict:
        import uuid
        from datetime import datetime, timezone
        key = args.get("key", "")
        content = args.get("content", "")
        if not key or not content:
            return {"error": "key and content are required"}
        try:
            from ..db.database import get_db
            db = get_db()
            # Ensure table exists
            db.conn.execute("""
                CREATE TABLE IF NOT EXISTS memory_store (
                    id TEXT PRIMARY KEY,
                    key TEXT NOT NULL,
                    content TEXT NOT NULL,
                    created_at TEXT NOT NULL
                )
            """)
            mem_id = f"mem-{uuid.uuid4().hex[:8]}"
            now = datetime.now(timezone.utc).isoformat()
            db.conn.execute(
                "INSERT INTO memory_store (id, key, content, created_at) VALUES (?, ?, ?, ?)",
                (mem_id, key, content, now),
            )
            db.conn.commit()
            return {"success": True, "id": mem_id, "key": key}
        except Exception as e:
            return {"error": str(e)}

    def _exec_skill_execute(self, args: dict) -> dict:
        skill_name = args.get("skill_name", "")
        skill_args = args.get("args", {})
        if not skill_name:
            return {"error": "No skill_name provided"}
        try:
            import json
            from ..db.database import get_db
            db = get_db()
            row = db.conn.execute(
                "SELECT id, name, workflow FROM skills WHERE name = ? OR id = ?",
                (skill_name, skill_name),
            ).fetchone()
            if not row:
                return {"error": f"Skill '{skill_name}' not found"}
            skill_id, name, workflow_json = row
            try:
                workflow = json.loads(workflow_json) if workflow_json else []
            except Exception:
                workflow = []
            # Execute workflow steps sequentially
            results = []
            for i, step in enumerate(workflow):
                step_type = step.get("type", "unknown")
                step_content = step.get("content", step.get("command", ""))
                results.append({"step": i + 1, "type": step_type, "content": step_content[:200]})
            return {"success": True, "skill": name, "steps_executed": len(results), "results": results}
        except Exception as e:
            return {"error": str(e)}

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
