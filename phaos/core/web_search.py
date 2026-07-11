"""Web Search — multi-engine search integration."""

from __future__ import annotations

import hashlib
import logging
import re
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
from urllib.parse import quote_plus, urlparse, parse_qs, urlencode

logger = logging.getLogger(__name__)

ENGINES = [
    {"id": "duckduckgo", "name": "DuckDuckGo", "requires_key": False},
    {"id": "google", "name": "Google", "requires_key": True},
    {"id": "bing", "name": "Bing", "requires_key": True},
    {"id": "searxng", "name": "SearXNG", "requires_key": False},
]


class SearchEngine:
    """Multi-engine web search with provider abstraction."""

    def __init__(self, config: Optional[Dict[str, Any]] = None):
        config = config or {}
        self.default_engine = config.get("default_engine", "duckduckgo")
        self.google_api_key = config.get("google_api_key", "")
        self.google_cx = config.get("google_cx", "")
        self.bing_api_key = config.get("bing_api_key", "")
        self.searxng_url = config.get("searxng_url", "http://localhost:8080")

    async def search(
        self,
        query: str,
        engine: Optional[str] = None,
        limit: int = 10,
        filters: Optional[Dict[str, Any]] = None,
    ) -> List[Dict[str, Any]]:
        engine_name = engine or self.default_engine
        if engine_name == "duckduckgo":
            results = await self._search_duckduckgo(query, limit)
        elif engine_name == "google":
            results = await self._search_google(query, limit)
        elif engine_name == "bing":
            results = await self._search_bing(query, limit)
        elif engine_name == "searxng":
            results = await self._search_searxng(query, limit)
        else:
            raise ValueError(f"Unknown engine: {engine_name}")

        if filters:
            results = self._apply_filters(results, filters)
        return results

    async def _search_duckduckgo(self, query: str, limit: int = 10) -> List[Dict[str, Any]]:
        """Search via DuckDuckGo lite HTML (no API key required)."""
        import httpx

        url = "https://lite.duckduckgo.com/lite/"
        data = {"q": query}
        results: List[Dict[str, Any]] = []

        try:
            async with httpx.AsyncClient(timeout=15, follow_redirects=True) as client:
                resp = await client.post(url, data=data)
                resp.raise_for_status()
                html = resp.text

            from bs4 import BeautifulSoup
            soup = BeautifulSoup(html, "lxml")

            for row in soup.select("table tr"):
                link = row.select_one("a.result-link")
                snippet_el = row.select_one("td.result-snippet")
                if link and link.get("href"):
                    href = link["href"]
                    if not href.startswith("http"):
                        continue
                    results.append({
                        "title": link.get_text(strip=True),
                        "url": href,
                        "snippet": snippet_el.get_text(strip=True) if snippet_el else "",
                        "source": "DuckDuckGo",
                        "timestamp": datetime.now(timezone.utc).isoformat(),
                    })
                    if len(results) >= limit:
                        break
        except Exception as e:
            logger.warning(f"DuckDuckGo search failed: {e}")

        if not results:
            results = self._placeholder_results(query, limit, "DuckDuckGo")
        return results

    async def _search_google(self, query: str, limit: int = 10) -> List[Dict[str, Any]]:
        if not self.google_api_key or not self.google_cx:
            return self._placeholder_results(query, limit, "Google")
        import httpx

        params = {
            "key": self.google_api_key,
            "cx": self.google_cx,
            "q": query,
            "num": min(limit, 10),
        }
        try:
            async with httpx.AsyncClient(timeout=15) as client:
                resp = await client.get("https://www.googleapis.com/customsearch/v1", params=params)
                resp.raise_for_status()
                data = resp.json()
            return [
                {
                    "title": item.get("title", ""),
                    "url": item.get("link", ""),
                    "snippet": item.get("snippet", ""),
                    "source": "Google",
                    "timestamp": datetime.now(timezone.utc).isoformat(),
                }
                for item in data.get("items", [])[:limit]
            ]
        except Exception as e:
            logger.warning(f"Google search failed: {e}")
            return self._placeholder_results(query, limit, "Google")

    async def _search_bing(self, query: str, limit: int = 10) -> List[Dict[str, Any]]:
        if not self.bing_api_key:
            return self._placeholder_results(query, limit, "Bing")
        import httpx

        headers = {"Ocp-Apim-Subscription-Key": self.bing_api_key}
        params = {"q": query, "count": min(limit, 50)}
        try:
            async with httpx.AsyncClient(timeout=15) as client:
                resp = await client.get(
                    "https://api.bing.microsoft.com/v7.0/search",
                    headers=headers,
                    params=params,
                )
                resp.raise_for_status()
                data = resp.json()
            return [
                {
                    "title": item.get("name", ""),
                    "url": item.get("url", ""),
                    "snippet": item.get("snippet", ""),
                    "source": "Bing",
                    "timestamp": datetime.now(timezone.utc).isoformat(),
                }
                for item in data.get("webPages", {}).get("value", [])[:limit]
            ]
        except Exception as e:
            logger.warning(f"Bing search failed: {e}")
            return self._placeholder_results(query, limit, "Bing")

    async def _search_searxng(self, query: str, limit: int = 10) -> List[Dict[str, Any]]:
        import httpx

        params = {"q": query, "format": "json", "pageno": 1}
        try:
            async with httpx.AsyncClient(timeout=15) as client:
                resp = await client.get(f"{self.searxng_url}/search", params=params)
                resp.raise_for_status()
                data = resp.json()
            return [
                {
                    "title": item.get("title", ""),
                    "url": item.get("url", ""),
                    "snippet": item.get("content", ""),
                    "source": "SearXNG",
                    "timestamp": datetime.now(timezone.utc).isoformat(),
                }
                for item in data.get("results", [])[:limit]
            ]
        except Exception as e:
            logger.warning(f"SearXNG search failed: {e}")
            return self._placeholder_results(query, limit, "SearXNG")

    def _apply_filters(self, results: List[Dict], filters: Dict[str, Any]) -> List[Dict]:
        filtered = results
        if "domain" in filters and filters["domain"]:
            domain = filters["domain"].lower()
            filtered = [r for r in filtered if domain in r.get("url", "").lower()]
        if "source" in filters and filters["source"]:
            src = filters["source"]
            filtered = [r for r in filtered if r.get("source") == src]
        if "exclude_domains" in filters:
            exclude = [d.lower() for d in filters["exclude_domains"]]
            filtered = [
                r for r in filtered
                if not any(d in r.get("url", "").lower() for d in exclude)
            ]
        return filtered

    def _placeholder_results(self, query: str, limit: int, source: str) -> List[Dict[str, Any]]:
        return [
            {
                "title": f"Result {i + 1} for \"{query}\"",
                "url": f"https://example.com/search?q={quote_plus(query)}&r={i + 1}",
                "snippet": f"Placeholder result {i + 1} for the query \"{query}\".",
                "source": source,
                "timestamp": datetime.now(timezone.utc).isoformat(),
                "placeholder": True,
            }
            for i in range(min(limit, 5))
        ]


_search_engine: Optional[SearchEngine] = None


def get_search_engine(config: Optional[Dict[str, Any]] = None) -> SearchEngine:
    global _search_engine
    if _search_engine is None:
        _search_engine = SearchEngine(config)
    return _search_engine


def reset_search_engine():
    global _search_engine
    _search_engine = None
