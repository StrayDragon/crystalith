"""Search module for Crystalith.

Provides web search capabilities via SearXNG integration.
"""

from __future__ import annotations

import asyncio
from typing import TYPE_CHECKING

from lush_logx.logging import get_logger

from .types import SearchResult

if TYPE_CHECKING:
    from collections.abc import Sequence

    from crystalith.shared.config import Settings

from crystalith.shared.config.endpoint_candidates import order_endpoint_candidates

__all__ = ["SearXNGSearcher", "SearchResult"]

log = get_logger(__name__)


# Engine mappings for different search modes
# Note: Scholar and Docs modes removed for now (frontend only supports Web)
MODE_ENGINE_MAP: dict[str, list[str]] = {
    "Web": ["google", "bing", "duckduckgo"],
}

SEARXNG_HEALTHCHECK_PATH = "/search?q=&format=json"


class SearXNGSearcher:
    """SearXNG-based web search provider using direct HTTP calls."""

    def __init__(
        self,
        host: str,
        *,
        endpoint_candidates: Sequence[str] | None = None,
        api_key: str | None = None,
        timeout: int = 10,
        max_results: int = 10,
    ) -> None:
        """Initialize the SearXNG searcher.

        Args:
            host: SearXNG instance URL (e.g., "http://localhost:8888")
            api_key: Optional API key for authentication
            timeout: Request timeout in seconds
            max_results: Maximum number of results to return
        """
        self.host = host
        self.endpoint_candidates = list(endpoint_candidates or [])
        self.api_key = api_key
        self.timeout = timeout
        self.max_results = max_results
        self._resolve_lock = asyncio.Lock()

    async def _resolve_host(self) -> str:
        if self.host and self.host.strip():
            return self.host.strip()

        candidates = order_endpoint_candidates(self.endpoint_candidates)
        if not candidates:
            raise RuntimeError(
                "SearXNG is not configured. Set `search.searxng.host` in config/app.yaml "
                "or provide `search.searxng.endpoint_candidates` (compose overlays supply endpoints automatically)."
            )

        async with self._resolve_lock:
            if self.host and self.host.strip():
                return self.host.strip()

            for candidate in candidates:
                target = candidate.rstrip("/")
                probe_url = f"{target}{SEARXNG_HEALTHCHECK_PATH}"
                try:
                    import httpx

                    async with httpx.AsyncClient(
                        timeout=max(0.5, min(float(self.timeout), 5.0)),
                        follow_redirects=True,
                    ) as client, client.stream("GET", probe_url) as resp:
                        status_code = resp.status_code
                    if 200 <= status_code < 300 or status_code == 400:
                        self.host = target
                        return target
                except Exception:
                    continue

        # None reachable: keep host empty and surface an actionable error.
        raise RuntimeError(
            "SearXNG endpoints are configured but unreachable. "
            "Check your `search.searxng.endpoint_candidates` and ensure the service is running."
        )

    async def _search_raw(
        self,
        query: str,
        engines: list[str],
    ) -> list[dict[str, object]]:
        """Execute a raw SearXNG search via direct HTTP call."""
        import httpx

        headers: dict[str, str] = {}
        if self.api_key:
            headers["Authorization"] = f"Bearer {self.api_key}"

        params: dict[str, str | list[str]] = {
            "q": query,
            "format": "json",
        }
        if engines:
            params["engines"] = engines

        host = self.host.rstrip("/")
        url = f"{host}/search"

        async with httpx.AsyncClient(
            timeout=float(self.timeout),
            follow_redirects=True,
        ) as client:
            response = await client.get(url, headers=headers, params=params)
            response.raise_for_status()
            data = response.json()

        # SearXNG JSON response shape: {"query": ..., "results": [...], ...}
        raw_results: list[dict[str, object]] = data.get("results", [])
        return raw_results

    async def search(
        self,
        query: str,
        *,
        mode: str = "Web",
    ) -> Sequence[SearchResult]:
        """Execute a search query and return results.

        Args:
            query: The search query string
            mode: Search mode - "Web", "Scholar", or "Docs"

        Returns:
            List of SearchResult objects

        Raises:
            ValueError: If query is empty
            RuntimeError: If search fails
        """
        if not query or not query.strip():
            raise ValueError("Search query cannot be empty")

        await self._resolve_host()

        target_engines = MODE_ENGINE_MAP.get(mode, MODE_ENGINE_MAP["Web"])

        try:
            raw_results = await self._search_raw(query, engines=target_engines)

            results: list[SearchResult] = []
            for item in raw_results:
                engines_raw = item.get("engines")
                engines_list = engines_raw if isinstance(engines_raw, list) else []
                engine_raw = engines_list[0] if engines_list else item.get("engine")
                engine: str | None = str(engine_raw) if engine_raw is not None else None
                result = SearchResult(
                    title=str(item.get("title") or ""),
                    url=str(item.get("link") or item.get("url") or ""),
                    snippet=str(item.get("snippet") or item.get("content") or ""),
                    engine=engine,
                )
                results.append(result)

            log.info(
                "search completed",
                query=query[:50],
                mode=mode,
                result_count=len(results),
            )
            return results

        except Exception as error:
            log.error(
                "search failed",
                error=str(error),
                error_type=type(error).__name__,
                query=query[:50],
                mode=mode,
            )
            raise RuntimeError(f"Search failed: {error}") from error

    @classmethod
    def from_settings(cls, settings: Settings) -> SearXNGSearcher:
        """Create a SearXNGSearcher from application settings.

        Args:
            settings: Application settings object

        Returns:
            Configured SearXNGSearcher instance
        """
        searxng_config = settings.search.searxng
        endpoint_candidates: list[str] = []
        if not (searxng_config.host or "").strip():
            endpoint_candidates.extend(searxng_config.endpoint_candidates)
            if (
                settings.optional_services.searxng.enabled
                or settings.optional_services.searxng.endpoint_candidates
            ):
                endpoint_candidates.extend(settings.optional_services.searxng.endpoint_candidates)
                if settings.optional_services.searxng.endpoint:
                    endpoint_candidates.append(settings.optional_services.searxng.endpoint)
        return cls(
            host=searxng_config.host,
            endpoint_candidates=endpoint_candidates,
            api_key=searxng_config.api_key,
            timeout=searxng_config.timeout,
            max_results=searxng_config.max_results,
        )
