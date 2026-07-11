"""Tests for Phase 13: Web Search & Scraping — search engines, scraper, history, routes."""

import asyncio
import pytest
import os
import sys
import sqlite3
import json

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from fastapi.testclient import TestClient
from phaos.main import app
from phaos.db.database import init_db
from phaos.core.web_search import SearchEngine, ENGINES, get_search_engine, reset_search_engine
from phaos.core.web_scraper import WebScraper, get_web_scraper, reset_web_scraper
from phaos.core.search_history import SearchHistory

_test_counter = 0


@pytest.fixture(autouse=True)
def client():
    global _test_counter
    _test_counter += 1
    db_path = f"./test_search_{_test_counter}.db"
    import phaos.db.database as db_mod
    db_mod._db = None
    init_db(db_path)
    reset_search_engine()
    reset_web_scraper()
    with TestClient(app) as c:
        yield c
    import phaos.db.database as db_mod
    db_mod._db = None
    try:
        os.remove(db_path)
    except OSError:
        pass


# ── SearchEngine ─────────────────────────────────────────────────


class TestSearchEngine:
    def test_engines_list(self):
        assert len(ENGINES) == 4
        ids = [e["id"] for e in ENGINES]
        assert "duckduckgo" in ids
        assert "google" in ids
        assert "bing" in ids
        assert "searxng" in ids

    def test_default_engine(self):
        engine = SearchEngine()
        assert engine.default_engine == "duckduckgo"

    def test_search_duckduckgo(self):
        engine = SearchEngine()
        results = asyncio.run(engine.search("python programming", engine="duckduckgo", limit=5))
        assert isinstance(results, list)
        assert len(results) > 0
        assert "title" in results[0]
        assert "url" in results[0]
        assert "snippet" in results[0]

    def test_search_returns_results(self):
        engine = SearchEngine()
        results = asyncio.run(engine.search("test query", limit=3))
        assert len(results) <= 3

    def test_search_with_domain_filter(self):
        engine = SearchEngine()
        results = asyncio.run(engine.search("test", limit=5, filters={"domain": "example.com"}))
        assert isinstance(results, list)

    def test_search_with_source_filter(self):
        engine = SearchEngine()
        results = asyncio.run(engine.search("test", limit=5, filters={"source": "DuckDuckGo"}))
        for r in results:
            assert r["source"] == "DuckDuckGo"

    def test_unknown_engine_raises(self):
        engine = SearchEngine()
        with pytest.raises(ValueError, match="Unknown engine"):
            asyncio.run(engine.search("test", engine="nonexistent"))

    def test_google_requires_key(self):
        engine = SearchEngine({"google_api_key": "", "google_cx": ""})
        results = asyncio.run(engine.search("test", engine="google", limit=3))
        assert len(results) > 0

    def test_bing_requires_key(self):
        engine = SearchEngine({"bing_api_key": ""})
        results = asyncio.run(engine.search("test", engine="bing", limit=3))
        assert len(results) > 0


# ── WebScraper ───────────────────────────────────────────────────


class TestWebScraper:
    def test_init_defaults(self):
        scraper = WebScraper()
        assert scraper.timeout == 30
        assert scraper.rate_limit == 1.0

    def test_scrape_returns_result(self):
        scraper = WebScraper({"rate_limit": 0})
        result = asyncio.run(scraper.scrape("https://example.com", format="markdown"))
        assert "url" in result
        assert "content" in result
        assert "links" in result

    def test_scrape_extracts_title(self):
        scraper = WebScraper({"rate_limit": 0})
        result = asyncio.run(scraper.scrape("https://example.com"))
        assert result.get("title") == "Example Domain"

    def test_scrape_extracts_links(self):
        scraper = WebScraper({"rate_limit": 0})
        result = asyncio.run(scraper.scrape("https://example.com"))
        assert isinstance(result.get("links", []), list)

    def test_scrape_invalid_url(self):
        scraper = WebScraper({"rate_limit": 0})
        result = asyncio.run(scraper.scrape("https://nonexistent.invalid.test"))
        assert "error" in result

    def test_scrape_text_format(self):
        scraper = WebScraper({"rate_limit": 0})
        result = asyncio.run(scraper.scrape("https://example.com", format="text"))
        assert result.get("format") == "text"
        assert len(result.get("content", "")) > 0

    def test_should_crawl_same_domain(self):
        scraper = WebScraper()
        assert scraper._should_crawl("https://example.com/page", "https://example.com", True) is True
        assert scraper._should_crawl("https://other.com/page", "https://example.com", True) is False

    def test_should_crawl_any_domain(self):
        scraper = WebScraper()
        assert scraper._should_crawl("https://other.com/page", "https://example.com", False) is True

    def test_should_crawl_rejects_non_http(self):
        scraper = WebScraper()
        assert scraper._should_crawl("ftp://example.com", "https://example.com", False) is False


# ── SearchHistory ────────────────────────────────────────────────


class TestSearchHistory:
    def test_add_and_get(self):
        db = sqlite3.connect(":memory:")
        hist = SearchHistory(db)
        sid = hist.add_search("python", "duckduckgo", [{"title": "r1", "url": "u1", "snippet": "s1", "source": "DDG", "timestamp": "t"}])
        assert sid is not None
        search = hist.get_search(sid)
        assert search is not None
        assert search["query"] == "python"
        assert search["engine"] == "duckduckgo"
        assert len(search["results"]) == 1
        db.close()

    def test_get_history(self):
        db = sqlite3.connect(":memory:")
        hist = SearchHistory(db)
        hist.add_search("q1", "duckduckgo", [])
        hist.add_search("q2", "google", [])
        history = hist.get_history()
        assert len(history) == 2
        db.close()

    def test_get_history_with_filter(self):
        db = sqlite3.connect(":memory:")
        hist = SearchHistory(db)
        hist.add_search("python tutorial", "duckduckgo", [])
        hist.add_search("javascript guide", "google", [])
        history = hist.get_history(query_filter="python")
        assert len(history) == 1
        assert history[0]["query"] == "python tutorial"
        db.close()

    def test_delete_search(self):
        db = sqlite3.connect(":memory:")
        hist = SearchHistory(db)
        sid = hist.add_search("test", "duckduckgo", [])
        assert hist.delete_search(sid) is True
        assert hist.get_search(sid) is None
        db.close()

    def test_delete_nonexistent(self):
        db = sqlite3.connect(":memory:")
        hist = SearchHistory(db)
        assert hist.delete_search("nonexistent") is False
        db.close()

    def test_clear_history(self):
        db = sqlite3.connect(":memory:")
        hist = SearchHistory(db)
        hist.add_search("q1", "duckduckgo", [])
        hist.add_search("q2", "duckduckgo", [])
        assert hist.clear_history() is True
        assert len(hist.get_history()) == 0
        db.close()

    def test_set_favorite(self):
        db = sqlite3.connect(":memory:")
        hist = SearchHistory(db)
        sid = hist.add_search("test", "duckduckgo", [])
        assert hist.set_favorite(sid, True) is True
        search = hist.get_search(sid)
        assert search["is_favorite"] == 1
        db.close()

    def test_get_favorites(self):
        db = sqlite3.connect(":memory:")
        hist = SearchHistory(db)
        sid1 = hist.add_search("fav1", "duckduckgo", [])
        sid2 = hist.add_search("fav2", "duckduckgo", [])
        hist.set_favorite(sid1, True)
        favs = hist.get_favorites()
        assert len(favs) == 1
        assert favs[0]["query"] == "fav1"
        db.close()

    def test_get_stats(self):
        db = sqlite3.connect(":memory:")
        hist = SearchHistory(db)
        sid = hist.add_search("test", "duckduckgo", [])
        hist.set_favorite(sid, True)
        stats = hist.get_stats()
        assert stats["total"] == 1
        assert stats["favorites"] == 1
        db.close()


# ── API Routes ───────────────────────────────────────────────────


class TestSearchRoutes:
    def test_search(self, client):
        res = client.post("/api/search/search", json={"query": "python", "limit": 3})
        assert res.status_code == 200
        data = res.json()
        assert data["query"] == "python"
        assert "results" in data
        assert data["count"] > 0

    def test_search_no_history(self, client):
        res = client.post("/api/search/search", json={"query": "test", "save_history": False})
        assert res.status_code == 200

    def test_get_engines(self, client):
        res = client.get("/api/search/engines")
        assert res.status_code == 200
        data = res.json()
        assert len(data["engines"]) == 4
        assert "default" in data

    def test_get_history(self, client):
        client.post("/api/search/search", json={"query": "history test"})
        res = client.get("/api/search/history")
        assert res.status_code == 200
        data = res.json()
        assert "searches" in data

    def test_delete_history(self, client):
        client.post("/api/search/search", json={"query": "to delete"})
        history = client.get("/api/search/history").json()["searches"]
        search_id = history[0]["id"]
        res = client.delete(f"/api/search/history/{search_id}")
        assert res.status_code == 200

    def test_clear_history(self, client):
        client.post("/api/search/search", json={"query": "clear me"})
        res = client.delete("/api/search/history")
        assert res.status_code == 200

    def test_toggle_favorite(self, client):
        client.post("/api/search/search", json={"query": "fav test"})
        history = client.get("/api/search/history").json()["searches"]
        search_id = history[0]["id"]
        res = client.post(f"/api/search/history/{search_id}/favorite", json={"favorite": True})
        assert res.status_code == 200

    def test_get_favorites(self, client):
        res = client.get("/api/search/favorites")
        assert res.status_code == 200
        assert "favorites" in res.json()

    def test_get_stats(self, client):
        res = client.get("/api/search/stats")
        assert res.status_code == 200
        data = res.json()
        assert "total" in data
        assert "favorites" in data

    def test_scrape(self, client):
        res = client.post("/api/search/scrape", json={"url": "https://example.com"})
        assert res.status_code == 200
        data = res.json()
        assert "content" in data
        assert "links" in data
