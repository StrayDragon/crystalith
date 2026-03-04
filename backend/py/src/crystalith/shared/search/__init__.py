"""Search module for Crystalith.

Provides web search capabilities via SearXNG integration.
"""

from __future__ import annotations

from typing import TYPE_CHECKING

from cl_logs.logging import get_logger

from .types import SearchResult

if TYPE_CHECKING:
    from collections.abc import Sequence

    from crystalith.shared.config import Settings
    from langchain_community.utilities import SearxSearchWrapper

__all__ = ["SearchResult", "SearXNGSearcher"]

log = get_logger(__name__)


# Engine mappings for different search modes
# Note: Scholar and Docs modes removed for now (frontend only supports Web)
MODE_ENGINE_MAP: dict[str, list[str]] = {
    "Web": ["google", "bing", "duckduckgo"],
}


class SearXNGSearcher:
    """SearXNG-based web search provider using LangChain wrapper."""

    def __init__(
        self,
        host: str,
        *,
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
        self.api_key = api_key
        self.timeout = timeout
        self.max_results = max_results
        self._wrapper: SearxSearchWrapper | None = None

    def _get_wrapper(self) -> SearxSearchWrapper:
        """Lazy initialization of the SearxSearchWrapper."""
        if self._wrapper is None:
            from langchain_community.utilities import SearxSearchWrapper

            # Build headers if API key is provided
            headers: dict[str, str] = {}
            if self.api_key:
                headers["Authorization"] = f"Bearer {self.api_key}"

            self._wrapper = SearxSearchWrapper(
                searx_host=self.host,
                k=self.max_results,
                headers=headers if headers else None,
            )
        return self._wrapper

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

        if not self.host or not self.host.strip():
            raise RuntimeError(
                "SearXNG is not configured. Set `search.searxng.host` in config/app.yaml "
                "or set env `CRYSTALITH_SEARCH__SEARXNG__HOST` (compose overlays can provide this)."
            )

        target_engines = MODE_ENGINE_MAP.get(mode, MODE_ENGINE_MAP["Web"])

        try:
            wrapper = self._get_wrapper()
            # SearxSearchWrapper.results() returns a list of dicts
            raw_results = wrapper.results(
                query,
                num_results=self.max_results,
                engines=target_engines,
            )

            results: list[SearchResult] = []
            for item in raw_results:
                # LangChain returns 'engines' (list) instead of 'engine' (str)
                engines_list = item.get("engines", [])
                engine = engines_list[0] if engines_list else item.get("engine")
                result = SearchResult(
                    title=item.get("title", ""),
                    url=item.get("link", item.get("url", "")),
                    snippet=item.get("snippet", item.get("content", "")),
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
        return cls(
            host=searxng_config.host,
            api_key=searxng_config.api_key,
            timeout=searxng_config.timeout,
            max_results=searxng_config.max_results,
        )
