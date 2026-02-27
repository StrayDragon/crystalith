from __future__ import annotations

from dataclasses import dataclass, field
from typing import TypedDict, cast

from pydantic import BaseModel, ConfigDict
from pydantic_ai import Agent
from pydantic_graph import BaseNode, End, Graph, GraphRunContext

from cl_logs.logging import get_logger

from crystalith.shared.agents.deps import StudioDeps
from crystalith.shared.agents.models import build_chat_model, extract_effective_model_settings_for_log
from crystalith.shared.search import SearXNGSearcher


log = get_logger(__name__)


class SearchResultDict(TypedDict):
    title: str
    url: str
    snippet: str
    source: str


class SearchGraphOutput(TypedDict):
    message: str
    results: list[SearchResultDict]


@dataclass
class SearchGraphState:
    """State object passed through the search graph."""

    query: str
    engine: str
    mode: str
    message: str = ""
    results: list[SearchResultDict] = field(default_factory=list)


class SearchSummary(BaseModel):
    model_config = ConfigDict(extra="forbid")

    summary: str
    next_step: str


SYSTEM_PROMPT = (
    "You are a research assistant. Provide a concise summary of the query and a "
    "suggested next step. Keep it within 2 sentences. Return JSON with keys summary and next_step."
)


# =============================================================================
# Graph Nodes
# =============================================================================


@dataclass
class GenerateSummary(BaseNode[SearchGraphState, StudioDeps, SearchGraphOutput]):
    """Generate a summary for the search query using LLM."""

    async def run(
        self, ctx: GraphRunContext[SearchGraphState, StudioDeps]
    ) -> "BuildResults":
        state = ctx.state
        deps = ctx.deps

        model = deps.model or build_chat_model(deps.settings)
        model_settings_log = extract_effective_model_settings_for_log(model)
        agent = Agent(
            model,
            output_type=SearchSummary,
            deps_type=StudioDeps,
            system_prompt=SYSTEM_PROMPT,
            retries=2,
        )
        user_prompt = f"Query: {state.query}\nMode: {state.mode}\nEngine: {state.engine}"

        try:
            result = await agent.run(user_prompt, deps=deps)
            state.message = f"{result.output.summary} {result.output.next_step}".strip()
        except Exception as error:  # noqa: BLE001 - fallback to empty message
            log.warning("search summary failed", error=type(error).__name__, **model_settings_log)
            state.message = ""

        return BuildResults()


@dataclass
class BuildResults(BaseNode[SearchGraphState, StudioDeps, SearchGraphOutput]):
    """Build search results using real search engine."""

    async def run(
        self, ctx: GraphRunContext[SearchGraphState, StudioDeps]
    ) -> End[SearchGraphOutput]:
        state = ctx.state
        deps = ctx.deps

        # Execute real search via SearXNG
        searcher = SearXNGSearcher.from_settings(deps.settings)
        search_results = await searcher.search(state.query, mode=state.mode)

        # Convert SearchResult objects to dicts for API response
        state.results = [
            cast(
                SearchResultDict,
                {
                    "title": r.title,
                    "url": r.url,
                    "snippet": r.snippet,
                    "source": r.engine or state.engine,
                },
            )
            for r in search_results
        ]

        log.info(
            "search completed",
            query=state.query[:50],
            result_count=len(state.results),
        )

        return End(cast(SearchGraphOutput, {"message": state.message, "results": state.results}))


# =============================================================================
# Graph Definition
# =============================================================================

SEARCH_GRAPH: Graph[SearchGraphState, StudioDeps, SearchGraphOutput] = Graph(
    nodes=[GenerateSummary, BuildResults]
)


async def run_search_graph(
    query: str,
    engine: str,
    mode: str,
    deps: StudioDeps,
) -> SearchGraphOutput:
    """Run the search graph and return the results."""
    state = SearchGraphState(
        query=query,
        engine=engine,
        mode=mode,
    )
    result = await SEARCH_GRAPH.run(GenerateSummary(), state=state, deps=deps)
    return cast(SearchGraphOutput, result.output)
