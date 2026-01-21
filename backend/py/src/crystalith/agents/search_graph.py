from __future__ import annotations

import urllib.parse
from dataclasses import dataclass, field
from typing import Any

from pydantic import BaseModel, ConfigDict
from pydantic_ai import Agent
from pydantic_graph import BaseNode, End, Graph, GraphRunContext

from cl_logs.logging import get_logger

from crystalith.agents.deps import StudioDeps
from crystalith.agents.models import build_chat_model


log = get_logger(__name__)


@dataclass
class SearchGraphState:
    """State object passed through the search graph."""

    query: str
    engine: str
    mode: str
    message: str = ""
    results: list[dict[str, Any]] = field(default_factory=list)


class SearchSummary(BaseModel):
    model_config = ConfigDict(extra="forbid")

    summary: str
    next_step: str


SYSTEM_PROMPT = (
    "You are a research assistant. Provide a concise summary of the query and a "
    "suggested next step. Keep it within 2 sentences. Return JSON with keys summary and next_step."
)


def _build_stub_results(query: str, engine: str, message: str | None) -> list[dict[str, Any]]:
    slug = urllib.parse.quote_plus(query)
    snippet = message or "基于当前查询生成的候选来源摘要。"
    return [
        {
            "title": f"{query} 综述",
            "url": f"https://example.com/search?q={slug}",
            "snippet": snippet,
            "source": engine,
        },
        {
            "title": f"{query} 关键观点整理",
            "url": f"https://example.com/articles/{slug}",
            "snippet": snippet,
            "source": engine,
        },
        {
            "title": f"{query} 实践案例",
            "url": f"https://example.com/cases/{slug}",
            "snippet": snippet,
            "source": engine,
        },
    ]


# =============================================================================
# Graph Nodes
# =============================================================================


@dataclass
class GenerateSummary(BaseNode[SearchGraphState, StudioDeps, dict[str, Any]]):
    """Generate a summary for the search query using LLM."""

    async def run(
        self, ctx: GraphRunContext[SearchGraphState, StudioDeps]
    ) -> "BuildResults":
        state = ctx.state
        deps = ctx.deps

        model = deps.model or build_chat_model(deps.settings)
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
            log.warning("search summary failed", exc_info=error)
            state.message = ""

        return BuildResults()


@dataclass
class BuildResults(BaseNode[SearchGraphState, StudioDeps, dict[str, Any]]):
    """Build search results based on the generated summary."""

    async def run(
        self, ctx: GraphRunContext[SearchGraphState, StudioDeps]
    ) -> End[dict[str, Any]]:
        state = ctx.state
        state.results = _build_stub_results(state.query, state.engine, state.message)
        return End({"message": state.message, "results": state.results})


# =============================================================================
# Graph Definition
# =============================================================================

SEARCH_GRAPH: Graph[SearchGraphState, StudioDeps, dict[str, Any]] = Graph(
    nodes=[GenerateSummary, BuildResults]
)


async def run_search_graph(
    query: str,
    engine: str,
    mode: str,
    deps: StudioDeps,
) -> dict[str, Any]:
    """Run the search graph and return the results."""
    state = SearchGraphState(
        query=query,
        engine=engine,
        mode=mode,
    )
    result = await SEARCH_GRAPH.run(GenerateSummary(), state=state, deps=deps)
    return result.output
