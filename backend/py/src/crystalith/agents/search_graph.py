from __future__ import annotations

import urllib.parse
from typing import Any, TypedDict

from langgraph.graph import END, StateGraph
from pydantic import BaseModel, ConfigDict
from pydantic_ai import Agent

from cl_logs.logging import get_logger

from crystalith.agents.deps import StudioDeps
from crystalith.agents.models import build_chat_model


log = get_logger(__name__)


class SearchState(TypedDict, total=False):
    query: str
    engine: str
    mode: str
    deps: StudioDeps
    message: str
    results: list[dict[str, Any]]


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


async def _generate_summary(state: SearchState) -> dict[str, Any]:
    deps = state["deps"]
    query = state["query"]
    mode = state["mode"]
    engine = state["engine"]

    model = deps.model or build_chat_model(deps.settings)
    agent = Agent(
        model,
        output_type=SearchSummary,
        deps_type=StudioDeps,
        system_prompt=SYSTEM_PROMPT,
        retries=2,
    )
    user_prompt = f"Query: {query}\nMode: {mode}\nEngine: {engine}"

    try:
        result = await agent.run(user_prompt, deps=deps)
        message = f"{result.output.summary} {result.output.next_step}".strip()
    except Exception as error:  # noqa: BLE001 - fallback to empty message
        log.warning("search summary failed", exc_info=error)
        message = ""

    return {"message": message}


async def _build_results(state: SearchState) -> dict[str, Any]:
    query = state["query"]
    engine = state["engine"]
    message = state.get("message")
    results = _build_stub_results(query, engine, message)
    return {"results": results}


def _build_graph():
    graph = StateGraph(SearchState)
    graph.add_node("generate_summary", _generate_summary)
    graph.add_node("build_results", _build_results)
    graph.set_entry_point("generate_summary")
    graph.add_edge("generate_summary", "build_results")
    graph.add_edge("build_results", END)
    return graph.compile()


_SEARCH_GRAPH = _build_graph()


async def run_search_graph(state: SearchState) -> dict[str, Any]:
    return await _SEARCH_GRAPH.ainvoke(state)
