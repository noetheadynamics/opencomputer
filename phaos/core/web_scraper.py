"""Web Scraper — extract clean content from web pages."""

from __future__ import annotations

import logging
import re
import time
from collections import defaultdict, deque
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
from urllib.parse import urljoin, urlparse

logger = logging.getLogger(__name__)


def _html_to_markdown(html: str) -> str:
    """Convert HTML to markdown without markdownify."""
    from bs4 import BeautifulSoup, NavigableString

    soup = BeautifulSoup(html, "lxml")
    for tag in soup(["script", "style", "noscript"]):
        tag.decompose()

    lines: List[str] = []
    for el in soup.find_all(["h1", "h2", "h3", "h4", "h5", "h6", "p", "li", "pre", "code", "blockquote", "a", "img"]):
        text = el.get_text(strip=True)
        if not text:
            continue
        tag = el.name
        if tag in ("h1", "h2", "h3", "h4", "h5", "h6"):
            level = int(tag[1])
            lines.append(f"{'#' * level} {text}")
        elif tag == "li":
            lines.append(f"- {text}")
        elif tag == "pre":
            lines.append(f"```\n{text}\n```")
        elif tag == "blockquote":
            lines.append(f"> {text}")
        elif tag == "a":
            href = el.get("href", "")
            if href:
                lines.append(f"[{text}]({href})")
            else:
                lines.append(text)
        elif tag == "img":
            alt = el.get("alt", "")
            src = el.get("src", "")
            lines.append(f"![{alt}]({src})")
        else:
            lines.append(text)

    if not lines:
        text = soup.get_text(separator="\n", strip=True)
        lines = [l for l in text.split("\n") if l.strip()]

    return "\n\n".join(lines)


class WebScraper:
    """Extract clean content from web pages with rate limiting."""

    def __init__(self, config: Optional[Dict[str, Any]] = None):
        config = config or {}
        self.timeout = config.get("timeout", 30)
        self.user_agent = config.get("user_agent", "OpenComputer/1.0 (compatible; research bot)")
        self.rate_limit = config.get("rate_limit", 1.0)
        self._last_request_time: float = 0.0

    async def scrape(
        self,
        url: str,
        depth: int = 1,
        max_pages: int = 10,
        extract_links: bool = True,
        format: str = "markdown",
    ) -> Dict[str, Any]:
        import time
        import httpx

        elapsed = time.time() - self._last_request_time
        if elapsed < self.rate_limit:
            import asyncio
            await asyncio.sleep(self.rate_limit - elapsed)
        self._last_request_time = time.time()

        try:
            async with httpx.AsyncClient(
                timeout=self.timeout,
                follow_redirects=True,
                headers={"User-Agent": self.user_agent},
            ) as client:
                resp = await client.get(url)
                resp.raise_for_status()
                content_type = resp.headers.get("content-type", "")
                if "text/html" not in content_type and "text/" not in content_type:
                    return {"url": url, "title": "", "content": resp.text[:5000], "format": format,
                            "links": [], "images": [], "timestamp": datetime.now(timezone.utc).isoformat()}
                html = resp.text

            from bs4 import BeautifulSoup
            soup = BeautifulSoup(html, "lxml")

            title_el = soup.find("title")
            title = title_el.get_text(strip=True) if title_el else ""

            meta_desc = soup.find("meta", attrs={"name": "description"})
            description = meta_desc.get("content", "") if meta_desc else ""

            for tag in soup(["script", "style", "nav", "footer", "header", "aside"]):
                tag.decompose()

            if format == "markdown":
                body = _html_to_markdown(str(soup))
            else:
                body = soup.get_text(separator="\n", strip=True)

            links: List[Dict[str, str]] = []
            if extract_links:
                for a in soup.find_all("a", href=True):
                    href = a["href"]
                    if not href.startswith(("http://", "https://", "mailto:", "tel:", "#")):
                        href = urljoin(url, href)
                    if href.startswith(("http://", "https://")):
                        links.append({"text": a.get_text(strip=True)[:100], "url": href})
                    if len(links) >= 50:
                        break

            images: List[Dict[str, str]] = []
            for img in soup.find_all("img", src=True):
                src = img["src"]
                if not src.startswith(("http://", "https://")):
                    src = urljoin(url, src)
                images.append({"alt": img.get("alt", ""), "src": src})
                if len(images) >= 20:
                    break

            return {
                "url": url,
                "title": title,
                "description": description,
                "content": body[:50000],
                "format": format,
                "links": links,
                "images": images,
                "timestamp": datetime.now(timezone.utc).isoformat(),
            }

        except Exception as e:
            logger.warning(f"Scrape failed for {url}: {e}")
            return {"url": url, "error": str(e), "title": "", "content": "", "links": [], "images": [],
                    "timestamp": datetime.now(timezone.utc).isoformat()}

    async def crawl(
        self,
        start_url: str,
        depth: int = 2,
        max_pages: int = 20,
        same_domain: bool = True,
    ) -> List[Dict[str, Any]]:
        visited: set = set()
        to_visit: deque = deque([(start_url, 0)])
        results: List[Dict[str, Any]] = []
        domain_last_access: Dict[str, float] = defaultdict(float)

        while to_visit and len(results) < max_pages:
            url, current_depth = to_visit.popleft()
            if url in visited:
                continue
            visited.add(url)

            domain = urlparse(url).netloc
            elapsed = time.time() - domain_last_access[domain]
            if elapsed < self.rate_limit:
                await __import__("asyncio").sleep(self.rate_limit - elapsed)
            domain_last_access[domain] = time.time()

            result = await self.scrape(url, depth=1, extract_links=True)
            results.append(result)

            if current_depth < depth:
                for link in result.get("links", []):
                    link_url = link.get("url", "")
                    if self._should_crawl(link_url, start_url, same_domain):
                        to_visit.append((link_url, current_depth + 1))

        return results

    def _should_crawl(self, url: str, start_url: str, same_domain: bool) -> bool:
        if not url.startswith(("http://", "https://")):
            return False
        if same_domain:
            start_netloc = urlparse(start_url).netloc
            url_netloc = urlparse(url).netloc
            if start_netloc != url_netloc:
                return False
        return True


_scraper: Optional[WebScraper] = None


def get_web_scraper(config: Optional[Dict[str, Any]] = None) -> WebScraper:
    global _scraper
    if _scraper is None:
        _scraper = WebScraper(config)
    return _scraper


def reset_web_scraper():
    global _scraper
    _scraper = None
