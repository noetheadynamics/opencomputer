"""PHAOS — Progressive Harness for Agentic Orchestration Systems."""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .routes import tasks, harness, skills, cron, audit, harness_management, conversations, memory, background_tasks, compact, routing, performance, preferences, merging, search, subagents, mcp, chat
from .db import init_db, init_slots, init_skills, init_harness_configs

app = FastAPI(
    title="PHAOS",
    description="Local AI agent backend for OpenComputer.",
    version="0.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:1420", "tauri://localhost"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(tasks.router, prefix="/api/tasks", tags=["tasks"])
app.include_router(harness.router, prefix="/api/harness", tags=["harness"])
app.include_router(harness_management.router, prefix="/api/harness/manage", tags=["harness-management"])
app.include_router(skills.router, prefix="/api/skills", tags=["skills"])
app.include_router(cron.router, prefix="/api/cron", tags=["cron"])
app.include_router(audit.router, prefix="/api/audit", tags=["audit"])
app.include_router(conversations.router, prefix="/api/conversations", tags=["conversations"])
app.include_router(memory.router, prefix="/api/memory", tags=["memory"])
app.include_router(background_tasks.router, prefix="/api/background-tasks", tags=["background-tasks"])
app.include_router(compact.router, prefix="/api/compact", tags=["compact"])
app.include_router(routing.router, prefix="/api/routing", tags=["routing"])
app.include_router(performance.router, prefix="/api/performance", tags=["performance"])
app.include_router(preferences.router, prefix="/api/preferences", tags=["preferences"])
app.include_router(merging.router, prefix="/api/merging", tags=["merging"])
app.include_router(search.router, prefix="/api/search", tags=["search"])
app.include_router(subagents.router, prefix="/api/subagents", tags=["subagents"])
app.include_router(mcp.router, prefix="/api", tags=["mcp"])
app.include_router(chat.router, prefix="/api/chat", tags=["chat"])


@app.on_event("startup")
async def startup_event():
    """Initialize database on startup."""
    init_db()
    init_slots()
    init_skills()
    init_harness_configs()
    from .routes.routing import _ensure_table
    _ensure_table()


@app.get("/health")
async def health():
    return {"status": "ok"}


def run():
    import uvicorn
    uvicorn.run("phaos.main:app", host="127.0.0.1", port=8420, reload=True)
