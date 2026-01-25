"""Types for the research module."""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import TYPE_CHECKING, Any

if TYPE_CHECKING:
    from sqlalchemy.ext.asyncio import AsyncSession

    from crystalith.config import Settings
    from crystalith.search import SearXNGSearcher


@dataclass
class SearchQuery:
    """A single search query."""

    query: str
    engine: str = "Web"
    priority: int = 1
    reason: str = ""


@dataclass
class SearchPlan:
    """A search plan for one iteration."""

    iteration: int
    queries: list[SearchQuery] = field(default_factory=list)
    reasoning: str = ""
    estimated_results: int = 10


@dataclass
class SearchResult:
    """A search result."""

    title: str
    url: str
    snippet: str
    source: str = ""
    iteration: int = 1
    relevance_score: float = 0.0


@dataclass
class IterationAnalysis:
    """Analysis result for one iteration."""

    iteration: int
    result_count: int
    coverage: float
    summary: str
    need_more_search: bool
    suggested_queries: list[str] = field(default_factory=list)


@dataclass
class ResearchGraphState:
    """State object passed through the research graph."""

    session_id: int
    notebook_id: int
    topic: str
    current_iteration: int = 1
    max_iterations: int = 4

    # Current search plan
    search_plan: SearchPlan | None = None

    # Results from all iterations
    all_results: list[SearchResult] = field(default_factory=list)

    # Current iteration results
    current_results: list[SearchResult] = field(default_factory=list)

    # Analysis from current iteration
    analysis: IterationAnalysis | None = None

    # Final report
    final_report: str = ""

    # Control flags
    should_continue: bool = True
    waiting_for_user: bool = False
    user_action: str | None = None  # approve, modify, skip, finish


@dataclass
class ResearchDeps:
    """Dependencies for the research graph."""

    settings: "Settings"
    session: "AsyncSession"
    searcher: "SearXNGSearcher"

    # Optional callbacks for progress updates
    on_progress: Any | None = None
    on_plan_ready: Any | None = None
    on_search_result: Any | None = None
    on_analysis: Any | None = None
