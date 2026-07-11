"""Web Search API routes — search, scrape, history, favorites."""

from __future__ import annotations

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Any, Dict, List, Optional

from ..core.web_search import get_search_engine, ENGINES
from ..core.web_scraper import get_web_scraper
from ..core.search_history import SearchHistory
from ..db.database import get_db

router = APIRouter(tags=["search"])


class SearchRequest(BaseModel):
    query: str
    engine: Optional[str] = None
    limit: int = 10
    filters: Optional[Dict[str, Any]] = None
    save_history: bool = True


class ScrapeRequest(BaseModel):
    url: str
    depth: int = 1
    max_pages: int = 10
    format: str = "markdown"


class FavoriteRequest(BaseModel):
    favorite: bool = True


_history: Optional[SearchHistory] = None


def _get_history() -> SearchHistory:
    global _history
    if _history is None:
        db = get_db()
        _history = SearchHistory(db.conn)
    return _history


@router.on_event("startup")
async def startup():
    _get_history()


@router.post("/search")
async def search(req: SearchRequest):
    engine = get_search_engine()
    search_engine = req.engine or engine.default_engine
    try:
        results = await engine.search(
            query=req.query,
            engine=req.engine,
            limit=req.limit,
            filters=req.filters,
        )
    except ValueError as e:
        return {"error": str(e), "query": req.query, "engine": search_engine, "results": [], "count": 0}
    search_id = None
    if req.save_history:
        hist = _get_history()
        search_id = hist.add_search(
            query=req.query,
            engine=search_engine,
            results=results,
            filters=req.filters,
        )
    return {
        "query": req.query,
        "engine": search_engine,
        "results": results,
        "count": len(results),
        "search_id": search_id,
    }


@router.post("/scrape")
async def scrape(req: ScrapeRequest):
    scraper = get_web_scraper()
    result = await scraper.scrape(
        url=req.url,
        depth=req.depth,
        max_pages=req.max_pages,
        format=req.format,
    )
    return result


@router.post("/crawl")
async def crawl(req: ScrapeRequest):
    scraper = get_web_scraper()
    results = await scraper.crawl(
        start_url=req.url,
        depth=req.depth,
        max_pages=req.max_pages,
    )
    return {"url": req.url, "pages": results, "count": len(results)}


@router.get("/history")
async def get_history(limit: int = 50, offset: int = 0, query: Optional[str] = None):
    hist = _get_history()
    searches = hist.get_history(limit, offset, query)
    return {"searches": searches, "count": len(searches), "limit": limit, "offset": offset}


@router.get("/history/{search_id}")
async def get_search(search_id: str):
    hist = _get_history()
    search = hist.get_search(search_id)
    if not search:
        raise HTTPException(status_code=404, detail="Search not found")
    return search


@router.delete("/history/{search_id}")
async def delete_search(search_id: str):
    hist = _get_history()
    if not hist.delete_search(search_id):
        raise HTTPException(status_code=404, detail="Search not found")
    return {"success": True}


@router.delete("/history")
async def clear_history():
    hist = _get_history()
    hist.clear_history()
    return {"success": True}


@router.post("/history/{search_id}/favorite")
async def toggle_favorite(search_id: str, req: FavoriteRequest):
    hist = _get_history()
    if not hist.set_favorite(search_id, req.favorite):
        raise HTTPException(status_code=404, detail="Search not found")
    return {"success": True, "favorite": req.favorite}


@router.get("/favorites")
async def get_favorites(limit: int = 50):
    hist = _get_history()
    return {"favorites": hist.get_favorites(limit)}


@router.get("/engines")
async def get_engines():
    engine = get_search_engine()
    return {"engines": ENGINES, "default": engine.default_engine}


@router.get("/stats")
async def get_stats():
    hist = _get_history()
    return hist.get_stats()


@router.get("/export/{search_id}")
async def export_search(search_id: str, format: str = "markdown"):
    hist = _get_history()
    search = hist.get_search(search_id)
    if not search:
        raise HTTPException(status_code=404, detail="Search not found")
    results = search.get("results", [])
    query = search.get("query", "")
    engine = search.get("engine", "")

    if format == "json":
        return {"query": query, "engine": engine, "results": results}

    lines = [f"# Search Results: {query}", f"*Engine: {engine}*", ""]
    for i, r in enumerate(results, 1):
        lines.append(f"## {i}. {r.get('title', 'Untitled')}")
        lines.append(f"**URL:** {r.get('url', '')}")
        lines.append(f"**Snippet:** {r.get('snippet', '')}")
        lines.append(f"**Source:** {r.get('source', '')}")
        lines.append("")
    return {"content": "\n".join(lines), "format": "markdown", "count": len(results)}
