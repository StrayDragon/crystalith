"""Type definitions for the search module."""

from __future__ import annotations

from pydantic import BaseModel, ConfigDict


class SearchResult(BaseModel):
    """A single search result."""

    model_config = ConfigDict(extra="forbid")

    title: str
    """Title of the search result."""

    url: str
    """URL of the search result."""

    snippet: str | None = None
    """Snippet or description of the search result."""

    engine: str | None = None
    """Search engine that returned this result."""
