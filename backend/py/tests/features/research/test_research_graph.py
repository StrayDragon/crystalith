from __future__ import annotations

import pytest

from crystalith.features.research.graph import (
    _extract_plan_from_steps,
    _parse_search_plan,
    _start_node_for_status,
    run_research_graph_from_session,
)
from crystalith.features.research.types import ResearchDeps
from crystalith.shared.db import Notebook, ResearchSession, ResearchStep
from crystalith.shared.search.types import SearchResult
from crystalith.shared.types import ResearchStatus, ResearchStepStatus, ResearchStepType


class _StubSearcher:
    def __init__(self, results: list[SearchResult]) -> None:
        self._results = results
        self.calls: list[tuple[str, str]] = []

    async def search(self, query: str, *, mode: str = "Web"):
        self.calls.append((query, mode))
        return list(self._results)


def test_parse_search_plan_filters_and_coerces_fields() -> None:
    assert _parse_search_plan({"queries": "nope"}, fallback_iteration=1) is None
    assert _parse_search_plan({"queries": []}, fallback_iteration=1) is None

    plan = _parse_search_plan(
        {
            "queries": [
                {"query": "  q  ", "engine": "Web", "priority": "2", "reason": "r"},
                {"query": " ", "engine": "Web"},
                "bad",
            ],
            "reasoning": "why",
            "estimated_results": "7",
        },
        fallback_iteration=3,
    )
    assert plan is not None
    assert plan.iteration == 3
    assert plan.estimated_results == 7
    assert len(plan.queries) == 1
    assert plan.queries[0].query == "q"
    assert plan.queries[0].priority == 2


def test_extract_plan_prefers_user_modified_plan() -> None:
    steps = [
        ResearchStep(
            session_id=1,
            iteration=1,
            type=ResearchStepType.PLAN,
            input_data=None,
            output_data={
                "queries": [{"query": "plan", "engine": "Web", "priority": 1}],
                "reasoning": "auto",
            },
            status=ResearchStepStatus.COMPLETED,
        ),
        ResearchStep(
            session_id=1,
            iteration=1,
            type=ResearchStepType.USER_INPUT,
            input_data={
                "action": "modify",
                "plan": {"queries": [{"query": "user", "engine": "Web", "priority": 1}]},
            },
            output_data=None,
            status=ResearchStepStatus.COMPLETED,
        ),
    ]

    plan = _extract_plan_from_steps(steps, iteration=1)
    assert plan is not None
    assert plan.queries[0].query == "user"


def test_start_node_for_status_selects_expected_nodes() -> None:
    assert _start_node_for_status(ResearchStatus.PLANNING, has_plan=False).__class__.__name__ == "PlanSearches"
    assert _start_node_for_status(ResearchStatus.WAITING_USER, has_plan=True).__class__.__name__ == "WaitForApproval"
    assert _start_node_for_status(ResearchStatus.SEARCHING, has_plan=True).__class__.__name__ == "ExecuteSearches"
    assert _start_node_for_status(ResearchStatus.ANALYZING, has_plan=True).__class__.__name__ == "AnalyzeResults"
    assert _start_node_for_status(ResearchStatus.COMPLETED, has_plan=True) is None
    assert _start_node_for_status(ResearchStatus.CANCELLED, has_plan=True) is None


@pytest.mark.asyncio
async def test_run_research_graph_from_session_runs_search_analyze_and_report(db_session, app) -> None:
    notebook = Notebook(name="Research Notebook")
    db_session.add(notebook)
    await db_session.flush()

    research = ResearchSession(
        notebook_id=notebook.id,
        topic="Test topic",
        status=ResearchStatus.SEARCHING,
        current_iteration=1,
        max_iterations=1,
        aggregated_results=[
            {
                "title": "Existing",
                "url": "https://example.com/existing",
                "snippet": "old",
                "source": "google",
                "iteration": 1,
            }
        ],
    )
    db_session.add(research)
    await db_session.flush()

    plan_step = ResearchStep(
        session_id=research.id,
        iteration=1,
        type=ResearchStepType.PLAN,
        input_data={"topic": research.topic},
        output_data={
            "queries": [{"query": "q", "engine": "Web", "priority": 1, "reason": "r"}],
            "reasoning": "auto",
            "iteration": 1,
        },
        status=ResearchStepStatus.COMPLETED,
    )
    db_session.add(plan_step)
    await db_session.commit()
    await db_session.refresh(research)
    _ = research.steps

    searcher = _StubSearcher(
        [
            SearchResult(
                title="Duplicate",
                url="https://example.com/existing",
                snippet="dup",
                engine="google",
            ),
            SearchResult(
                title="New result",
                url="https://example.com/new",
                snippet="new",
                engine="bing",
            ),
        ]
    )

    deps = ResearchDeps(settings=app.state.settings, session=db_session, searcher=searcher)
    output = await run_research_graph_from_session(research, deps)

    assert output["status"] == "completed"
    total_results = output.get("total_results")
    assert isinstance(total_results, int)
    assert total_results >= 1
    assert searcher.calls

    refreshed = await db_session.get(ResearchSession, research.id)
    assert refreshed is not None
    assert refreshed.status == ResearchStatus.COMPLETED
    assert refreshed.final_report
    assert refreshed.aggregated_results

    urls = {item["url"] for item in refreshed.aggregated_results or [] if isinstance(item, dict)}
    assert "https://example.com/new" in urls
