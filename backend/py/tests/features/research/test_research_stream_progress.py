from __future__ import annotations

import asyncio
import contextlib
import datetime
import json

import pytest

from crystalith.shared.db import ResearchSession, ResearchStep
from crystalith.shared.types import ResearchStatus, ResearchStepStatus, ResearchStepType


@pytest.mark.asyncio
async def test_research_stream_emits_plan_search_analysis_report_waiting_and_done(client, app) -> None:
    notebook_resp = await client.post("/v1/notebooks", json={"name": "Research Stream Progress"})
    assert notebook_resp.status_code == 201
    notebook_id = notebook_resp.json()["id"]

    create_resp = await client.post(
        f"/v1/notebooks/{notebook_id}/research",
        json={"topic": "StreamTopic", "max_iterations": 2},
    )
    assert create_resp.status_code == 201
    research_id = create_resp.json()["id"]

    # Prevent the stream endpoint from auto-resuming background tasks.
    async with app.state.db.got_manual_session() as session:
        research = await session.get(ResearchSession, research_id)
        assert research is not None
        now = datetime.datetime.now(datetime.UTC).replace(tzinfo=None)
        research.locked_at = now
        research.lock_expires_at = now + datetime.timedelta(minutes=20)
        await session.commit()

    waiting_seen = asyncio.Event()

    async def _updater() -> None:
        async with app.state.db.got_manual_session() as session:
            research = await session.get(ResearchSession, research_id)
            assert research is not None

            research.status = ResearchStatus.WAITING_USER
            session.add(
                ResearchStep(
                    session_id=research.id,
                    iteration=1,
                    type=ResearchStepType.PLAN,
                    status=ResearchStepStatus.COMPLETED,
                    output_data={
                        "queries": [
                            {"query": "q1", "engine": "Web", "priority": 1, "reason": "r1"},
                            {"query": "q2", "engine": "Web", "priority": 2, "reason": "r2"},
                        ],
                        "reasoning": "why",
                        "estimated_results": 2,
                    },
                )
            )
            await session.commit()

        with contextlib.suppress(TimeoutError):
            await asyncio.wait_for(waiting_seen.wait(), timeout=10)

        async with app.state.db.got_manual_session() as session:
            research = await session.get(ResearchSession, research_id)
            assert research is not None
            research.status = ResearchStatus.COMPLETED
            research.current_iteration = 2
            research.aggregated_results = [{"title": "T", "url": "https://example.com", "snippet": "S"}]
            research.final_report = "Final report"

            session.add_all([
                ResearchStep(
                    session_id=research.id,
                    iteration=2,
                    type=ResearchStepType.SEARCH,
                    status=ResearchStepStatus.COMPLETED,
                    output_data={"result_count": 3, "new_results": 2},
                ),
                ResearchStep(
                    session_id=research.id,
                    iteration=2,
                    type=ResearchStepType.ANALYZE,
                    status=ResearchStepStatus.COMPLETED,
                    output_data={
                        "summary": "insight",
                        "coverage": 0.6,
                        "need_more_search": True,
                    },
                ),
                ResearchStep(
                    session_id=research.id,
                    iteration=2,
                    type=ResearchStepType.SUMMARY,
                    status=ResearchStepStatus.COMPLETED,
                    output_data={"report_length": 42},
                ),
            ])
            await session.commit()

    update_task = asyncio.create_task(_updater())

    async def _collect_events() -> list[str]:
        events: list[str] = []
        async with client.stream(
            "GET",
            f"/v1/notebooks/{notebook_id}/research/{research_id}/stream",
        ) as response:
            assert response.status_code == 200

            current_event: str | None = None
            async for line in response.aiter_lines():
                if not line:
                    continue
                if line.startswith("event: "):
                    current_event = line.removeprefix("event: ").strip()
                    continue
                if current_event and line.startswith("data: "):
                    _ = json.loads(line.removeprefix("data: ").strip() or "{}")
                    events.append(current_event)
                    if current_event == "waiting":
                        waiting_seen.set()
                    if current_event == "done":
                        break
                    current_event = None
        return events

    try:
        events = await asyncio.wait_for(_collect_events(), timeout=20)
    finally:
        if not update_task.done():
            update_task.cancel()
            with contextlib.suppress(asyncio.CancelledError):
                await update_task

    if update_task.done():
        update_task_exc = update_task.exception()
        if update_task_exc is not None:
            raise update_task_exc

    assert {"status", "thinking", "plan_ready", "search_progress", "analysis", "report", "waiting", "done"} <= set(events)
