"""Types for the research module."""

from __future__ import annotations

from dataclasses import dataclass, field
from collections.abc import Awaitable, Callable
from typing import TYPE_CHECKING

from crystalith.shared.json_types import JsonDict

if TYPE_CHECKING:
    from sqlalchemy.ext.asyncio import AsyncSession

    from crystalith.shared.config import Settings
    from crystalith.shared.search import SearXNGSearcher


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


ProgressCallback = Callable[[JsonDict], Awaitable[None]]
PlanReadyCallback = Callable[[SearchPlan | None], Awaitable[None]]
SearchResultCallback = Callable[[SearchResult], Awaitable[None]]
AnalysisCallback = Callable[[IterationAnalysis | None], Awaitable[None]]
ThinkingCallback = Callable[[JsonDict], Awaitable[None]]


from enum import Enum


class ResearchOutputType(str, Enum):
    """Type of research output/artifact."""

    REPORT = "report"  # Main research report
    SUB_REPORT = "sub_report"  # Section or sub-topic report
    REFERENCE = "reference"  # A cited reference with metadata
    LINK = "link"  # Raw link to be fetched or added
    RAW_RESULT = "raw_result"  # Unprocessed search result


@dataclass
class ResearchOutput:
    """A research output/artifact that can be exported.

    This represents any piece of content generated during research
    that the user might want to export to their notebook.
    """

    type: ResearchOutputType
    title: str
    content: str  # Main content (report text, reference summary, URL, etc.)

    # Metadata
    url: str | None = None  # URL for references/links
    source_iteration: int = 1  # Which iteration this came from
    relevance_score: float = 0.0  # How relevant to the topic (0-1)

    # For references
    snippet: str = ""  # Brief excerpt
    citation_index: int | None = None  # [1], [2], etc. in the report

    # Export options
    can_export_as_source: bool = True
    can_export_as_note: bool = True
    recommended_extractor: str | None = None  # For links: which extractor to use


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
    on_progress: ProgressCallback | None = None
    on_plan_ready: PlanReadyCallback | None = None
    on_search_result: SearchResultCallback | None = None
    on_analysis: AnalysisCallback | None = None
    on_thinking: ThinkingCallback | None = None  # Callback for streaming thinking content
