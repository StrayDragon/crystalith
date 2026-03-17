from __future__ import annotations

from types import SimpleNamespace

import pytest
from sqlalchemy import select

from crystalith.features.research.graph import (
    AnalyzeResults,
    ExecuteSearches,
    GenerateReport,
    PlanSearches,
    WaitForApproval,
)
from crystalith.features.research.types import ResearchDeps, ResearchGraphState, SearchPlan, SearchQuery, SearchResult
from crystalith.shared.db import Notebook, ResearchSession, ResearchStep
from crystalith.shared.types import ResearchStatus, ResearchStepStatus, ResearchStepType
from tests._support.settings import make_settings


class _StubSearcher:
    async def search(self, query: str, *, mode: str = "Web"):
        return []


@pytest.mark.asyncio
async def test_plan_searches_records_step_and_moves_to_waiting_user(db_session, app) -> None:
    notebook = Notebook(name="Research Nodes")
    db_session.add(notebook)
    await db_session.flush()

    research = ResearchSession(
        notebook_id=notebook.id,
        topic="Node topic",
        status=ResearchStatus.PLANNING,
        current_iteration=1,
        max_iterations=2,
    )
    db_session.add(research)
    await db_session.commit()
    await db_session.refresh(research)

    state = ResearchGraphState(
        session_id=research.id,
        notebook_id=notebook.id,
        topic=research.topic,
        current_iteration=1,
        max_iterations=2,
    )
    deps = ResearchDeps(settings=app.state.settings, session=db_session, searcher=_StubSearcher())
    ctx = SimpleNamespace(state=state, deps=deps)

    next_node = await PlanSearches().run(ctx)  # type: ignore[arg-type]
    assert next_node.__class__.__name__ == "WaitForApproval"
    assert state.search_plan is not None
    assert state.search_plan.queries

    refreshed = await db_session.get(ResearchSession, research.id)
    assert refreshed is not None
    assert refreshed.status == ResearchStatus.WAITING_USER

    steps = (
        await db_session.execute(
            select(ResearchStep).where(ResearchStep.session_id == research.id, ResearchStep.type == ResearchStepType.PLAN)
        )
    ).scalars().all()
    assert steps


@pytest.mark.asyncio
async def test_wait_for_approval_skip_increments_iteration(db_session, app) -> None:
    notebook = Notebook(name="Research Wait Skip")
    db_session.add(notebook)
    await db_session.flush()

    research = ResearchSession(
        notebook_id=notebook.id,
        topic="Skip topic",
        status=ResearchStatus.SEARCHING,
        current_iteration=1,
        max_iterations=2,
    )
    db_session.add(research)
    await db_session.flush()
    db_session.add(
        ResearchStep(
            session_id=research.id,
            iteration=1,
            type=ResearchStepType.USER_INPUT,
            input_data={"action": "skip"},
            output_data=None,
            status=ResearchStepStatus.COMPLETED,
        )
    )
    await db_session.commit()

    state = ResearchGraphState(
        session_id=research.id,
        notebook_id=notebook.id,
        topic=research.topic,
        current_iteration=1,
        max_iterations=2,
    )
    deps = ResearchDeps(settings=app.state.settings, session=db_session, searcher=_StubSearcher())
    ctx = SimpleNamespace(state=state, deps=deps)

    next_node = await WaitForApproval().run(ctx)  # type: ignore[arg-type]
    assert next_node.__class__.__name__ == "AnalyzeResults"
    assert state.current_iteration == 2


@pytest.mark.asyncio
async def test_wait_for_approval_modify_updates_plan_and_executes(db_session, app) -> None:
    notebook = Notebook(name="Research Wait Modify")
    db_session.add(notebook)
    await db_session.flush()

    research = ResearchSession(
        notebook_id=notebook.id,
        topic="Modify topic",
        status=ResearchStatus.SEARCHING,
        current_iteration=1,
        max_iterations=1,
    )
    db_session.add(research)
    await db_session.flush()
    db_session.add(
        ResearchStep(
            session_id=research.id,
            iteration=1,
            type=ResearchStepType.USER_INPUT,
            input_data={
                "action": "modify",
                "plan": {"queries": [{"query": "q", "engine": "Web", "priority": 1, "reason": "r"}], "reasoning": "user"},
            },
            output_data=None,
            status=ResearchStepStatus.COMPLETED,
        )
    )
    await db_session.commit()

    state = ResearchGraphState(
        session_id=research.id,
        notebook_id=notebook.id,
        topic=research.topic,
        current_iteration=1,
        max_iterations=1,
        search_plan=SearchPlan(iteration=1, queries=[SearchQuery(query="old")]),
    )
    deps = ResearchDeps(settings=app.state.settings, session=db_session, searcher=_StubSearcher())
    ctx = SimpleNamespace(state=state, deps=deps)

    next_node = await WaitForApproval().run(ctx)  # type: ignore[arg-type]
    assert next_node.__class__.__name__ == "ExecuteSearches"
    assert state.search_plan is not None
    assert state.search_plan.reasoning == "user"
    assert state.search_plan.queries[0].query == "q"


@pytest.mark.asyncio
async def test_analyze_results_fallback_can_request_more_search(db_session) -> None:
    # Create settings that force build_chat_model() to fail, exercising fallback.
    bad_settings = make_settings(
        {
            "app": {"cors": {"allow_origins": []}},
            "cache": {"provider": "memory"},
            "vector_storage": {"provider": "memory"},
            "models": {
                "defaults": {"chat": "bad-openai"},
                "available": [
                    {
                        "id": "bad-openai",
                        "provider": "openai",
                        "model": "gpt-4o-mini",
                        "display_name": "Bad OpenAI",
                        "roles": ["chat"],
                        "provider_config": {"api_key": ""},
                    }
                ],
            },
        }
    )

    notebook = Notebook(name="Research Analyze Fallback")
    db_session.add(notebook)
    await db_session.flush()
    research = ResearchSession(
        notebook_id=notebook.id,
        topic="Fallback topic",
        status=ResearchStatus.SEARCHING,
        current_iteration=1,
        max_iterations=2,
    )
    db_session.add(research)
    await db_session.commit()

    state = ResearchGraphState(
        session_id=research.id,
        notebook_id=notebook.id,
        topic=research.topic,
        current_iteration=1,
        max_iterations=2,
        all_results=[
            SearchResult(title="T", url="https://example.com", snippet="S", iteration=1),
        ],
    )
    deps = ResearchDeps(settings=bad_settings, session=db_session, searcher=_StubSearcher())
    ctx = SimpleNamespace(state=state, deps=deps)

    next_node = await AnalyzeResults().run(ctx)  # type: ignore[arg-type]
    assert next_node.__class__.__name__ == "PlanSearches"
    assert state.current_iteration == 2


@pytest.mark.asyncio
async def test_generate_report_skips_when_cancelled(db_session, app) -> None:
    notebook = Notebook(name="Research Cancelled")
    db_session.add(notebook)
    await db_session.flush()
    research = ResearchSession(
        notebook_id=notebook.id,
        topic="Cancelled topic",
        status=ResearchStatus.CANCELLED,
        current_iteration=1,
        max_iterations=1,
    )
    db_session.add(research)
    await db_session.commit()

    state = ResearchGraphState(
        session_id=research.id,
        notebook_id=notebook.id,
        topic=research.topic,
        current_iteration=1,
        max_iterations=1,
        all_results=[],
    )
    deps = ResearchDeps(settings=app.state.settings, session=db_session, searcher=_StubSearcher())
    ctx = SimpleNamespace(state=state, deps=deps)

    end = await GenerateReport().run(ctx)  # type: ignore[arg-type]
    assert end.data["status"] == ResearchStatus.CANCELLED.value


@pytest.mark.asyncio
async def test_execute_searches_skips_without_plan(db_session, app) -> None:
    state = ResearchGraphState(session_id=1, notebook_id=1, topic="x")
    deps = ResearchDeps(settings=app.state.settings, session=db_session, searcher=_StubSearcher())
    ctx = SimpleNamespace(state=state, deps=deps)
    next_node = await ExecuteSearches().run(ctx)  # type: ignore[arg-type]
    assert next_node.__class__.__name__ == "AnalyzeResults"
