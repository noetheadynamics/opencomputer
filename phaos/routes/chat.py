"""Chat route — streaming agentic chat with tool execution through PHAOS."""

import json
import logging
import time
from typing import Any

import httpx
from fastapi import APIRouter
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from ..engine.tool_router import SandboxedExecutor

logger = logging.getLogger(__name__)

router = APIRouter()

# Global executor — initialized lazily
_executor: SandboxedExecutor | None = None


def get_executor() -> SandboxedExecutor:
    global _executor
    if _executor is None:
        _executor = SandboxedExecutor()
    return _executor


class ChatMessage(BaseModel):
    role: str
    content: str


class ChatRequest(BaseModel):
    messages: list[ChatMessage]
    provider: dict[str, Any]  # {baseUrl, apiKey, model}
    system_prompt: str | None = None
    max_iterations: int = 10


def _build_tools_payload(executor: SandboxedExecutor) -> list[dict]:
    """Convert PHAOS tool registry to OpenAI function-calling format."""
    return executor.registry.get_definitions_for_llm()


def _format_tool_result(result: dict) -> str:
    """Format a tool execution result for the LLM."""
    if result.get("success"):
        output = result.get("output", "")
        if isinstance(output, dict):
            return json.dumps(output, indent=2)
        return str(output)
    return f"Error: {result.get('error', 'Unknown error')}"


async def _stream_chat(req: ChatRequest):
    """Generator that yields SSE events for the chat stream."""
    executor = get_executor()
    tools = _build_tools_payload(executor)

    # Build messages
    messages = []
    if req.system_prompt:
        messages.append({"role": "system", "content": req.system_prompt})
    for m in req.messages:
        messages.append({"role": m.role, "content": m.content})

    # Auto-scan workspace root on first message so the LLM knows the project structure
    if len(req.messages) <= 1:
        try:
            import os
            workspace = os.getenv("PHAOS_WORKSPACE", os.getcwd())
            entries = []
            for name in sorted(os.listdir(workspace)):
                full = os.path.join(workspace, name)
                if os.path.isdir(full):
                    entries.append(f"  {name}/")
                else:
                    size = os.path.getsize(full)
                    entries.append(f"  {name} ({size} bytes)")
            if entries:
                scan_text = "\n".join(entries)
                messages.append({
                    "role": "system",
                    "content": f"[Auto-scan: workspace root '{workspace}']\n{scan_text}",
                })
        except Exception:
            pass

    base_url = req.provider.get("baseUrl", "").rstrip("/")
    api_key = req.provider.get("apiKey", "")
    model = req.provider.get("model", "gpt-4o-mini")

    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
    }

    iteration = 0
    full_response = ""

    while iteration < req.max_iterations:
        iteration += 1
        start = time.time()

        # Call LLM with tools
        payload = {
            "model": model,
            "messages": messages,
            "tools": tools if tools else None,
            "stream": True,
        }
        if not tools:
            payload.pop("tools", None)

        try:
            async with httpx.AsyncClient(timeout=120.0) as client:
                async with client.stream(
                    "POST",
                    f"{base_url}/chat/completions",
                    headers=headers,
                    json=payload,
                ) as resp:
                    if resp.status_code != 200:
                        body = await resp.aread()
                        yield f"data: {json.dumps({'error': f'Provider returned {resp.status_code}: {body[:200].decode()}'})}\n\n"
                        return

                    tool_calls_buffer: dict[int, dict] = {}
                    content_buffer = ""

                    async for line in resp.aiter_lines():
                        if not line.startswith("data: "):
                            continue
                        data = line[6:]
                        if data.strip() == "[DONE]":
                            break
                        try:
                            chunk = json.loads(data)
                            delta = chunk["choices"][0]["delta"]
                            finish = chunk["choices"][0].get("finish_reason")

                            # Content tokens
                            if delta.get("content"):
                                token = delta["content"]
                                content_buffer += token
                                yield f"data: {json.dumps({'token': token})}\n\n"

                            # Tool call deltas
                            if delta.get("tool_calls"):
                                for tc in delta["tool_calls"]:
                                    idx = tc["index"]
                                    if idx not in tool_calls_buffer:
                                        tool_calls_buffer[idx] = {
                                            "id": tc.get("id", ""),
                                            "type": "function",
                                            "function": {"name": "", "arguments": ""},
                                        }
                                    buf = tool_calls_buffer[idx]
                                    if tc.get("id"):
                                        buf["id"] = tc["id"]
                                    fn = tc.get("function", {})
                                    if fn.get("name"):
                                        buf["function"]["name"] = fn["name"]
                                    if fn.get("arguments"):
                                        buf["function"]["arguments"] += fn["arguments"]

                            if finish == "stop":
                                full_response += content_buffer
                                yield f"data: {json.dumps({'done': True, 'full_response': full_response})}\n\n"
                                return

                            if finish == "tool_calls":
                                break

                        except json.JSONDecodeError:
                            continue

        except httpx.ConnectError as e:
            yield f"data: {json.dumps({'error': f'Cannot connect to provider at {base_url}: {e}'})}\n\n"
            return
        except Exception as e:
            yield f"data: {json.dumps({'error': str(e)})}\n\n"
            return

        # If no tool calls, we're done
        if not tool_calls_buffer:
            full_response += content_buffer
            yield f"data: {json.dumps({'done': True, 'full_response': full_response})}\n\n"
            return

        # Execute tool calls
        tool_results = []
        for idx in sorted(tool_calls_buffer.keys()):
            tc = tool_calls_buffer[idx]
            fn_name = tc["function"]["name"]
            try:
                fn_args = json.loads(tc["function"]["arguments"]) if tc["function"]["arguments"] else {}
            except json.JSONDecodeError:
                fn_args = {}

            # Notify frontend about tool call
            yield f"data: {json.dumps({'tool_call': {'id': tc['id'], 'name': fn_name, 'args': fn_args}})}\n\n"

            # Execute
            result = executor.registry.execute(fn_name, fn_args)
            result_dict = {"success": result.success, "output": result.output, "error": result.error}

            # If tool requires approval, yield that
            if result_dict.get("output", {}).get("status") == "approval_required":
                yield f"data: {json.dumps({'approval_required': result_dict['output']})}\n\n"
                # For now, auto-approve in chat mode
                req_id = result_dict["output"]["request_id"]
                executor.registry.approve(req_id)
                result = executor.registry.execute(fn_name, fn_args)
                result_dict = {"success": result.success, "output": result.output, "error": result.error}

            result_str = _format_tool_result(result_dict)
            tool_results.append({"tool_call_id": tc["id"], "role": "tool", "content": result_str})

            yield f"data: {json.dumps({'tool_result': {'id': tc['id'], 'name': fn_name, 'result': result_str[:500]}})}\n\n"

        # Append assistant message with tool calls to history
        assistant_tool_calls = []
        for idx in sorted(tool_calls_buffer.keys()):
            tc = tool_calls_buffer[idx]
            assistant_tool_calls.append({
                "id": tc["id"],
                "type": "function",
                "function": {"name": tc["function"]["name"], "arguments": tc["function"]["arguments"]},
            })
        messages.append({"role": "assistant", "content": content_buffer or None, "tool_calls": assistant_tool_calls})

        # Append tool results
        for tr in tool_results:
            messages.append(tr)

        # Loop continues for next iteration

    yield f"data: {json.dumps({'done': True, 'full_response': full_response, 'warning': f'Max iterations ({req.max_iterations}) reached'})}\n\n"


@router.post("")
async def chat(req: ChatRequest):
    """Streaming chat endpoint with agentic tool execution.

    Accepts the same message format as OpenAI chat completions,
    plus provider config. Streams SSE events with tokens, tool calls, and results.
    """
    return StreamingResponse(
        _stream_chat(req),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )
