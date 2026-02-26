from __future__ import annotations

import datetime

import pytest
import sqlalchemy as sa

from crystalith.shared.db import ResearchSession, ResearchStep
from crystalith.shared.types import ResearchStatus


@pytest.mark.asyncio
async def test_research_interaction_endpoints_enforce_state_and_record_steps(client, db_session) -> None:
    notebook_resp = await client.post("/v1/notebooks", json={"name": "Research Interactions"})
    assert notebook_resp.status_code == 201
    notebook_id = notebook_resp.json()["id"]

    create_resp = await client.post(
        f"/v1/notebooks/{notebook_id}/research",
        json={"topic": "AI", "max_iterations": 2},
    )
    assert create_resp.status_code == 201
    research_id = create_resp.json()["id"]

    # Approve should fail unless waiting_user
    bad = await client.post(f"/v1/notebooks/{notebook_id}/research/{research_id}/approve", json={})
    assert bad.status_code == 400

    # Put into WAITING_USER and hold a lock so background tasks are not scheduled
    research = await db_session.get(ResearchSession, research_id)
    assert research is not None
    research.status = ResearchStatus.WAITING_USER
    now = datetime.datetime.now(datetime.UTC).replace(tzinfo=None)
    research.locked_at = now
    research.lock_expires_at = now + datetime.timedelta(minutes=20)
    await db_session.commit()

    approve = await client.post(
        f"/v1/notebooks/{notebook_id}/research/{research_id}/approve",
        json={"feedback": "ok"},
    )
    assert approve.status_code == 200
    assert approve.json()["status"] == ResearchStatus.SEARCHING.value

    steps = (
        await db_session.execute(
            ResearchStep.__table__.select().where(ResearchStep.session_id == research_id)
        )
    ).fetchall()
    assert steps


@pytest.mark.asyncio
async def test_research_modify_skip_finish_cancel_and_export(client, app, db_session) -> None:
    notebook_resp = await client.post("/v1/notebooks", json={"name": "Research Export"})
    assert notebook_resp.status_code == 201
    notebook_id = notebook_resp.json()["id"]

    create_resp = await client.post(
        f"/v1/notebooks/{notebook_id}/research",
        json={"topic": "ExportTopic", "max_iterations": 2},
    )
    assert create_resp.status_code == 201
    research_id = create_resp.json()["id"]

    research = await db_session.get(ResearchSession, research_id)
    assert research is not None
    research.status = ResearchStatus.WAITING_USER
    now = datetime.datetime.now(datetime.UTC).replace(tzinfo=None)
    research.locked_at = now
    research.lock_expires_at = now + datetime.timedelta(minutes=20)
    await db_session.commit()

    modify = await client.post(
        f"/v1/notebooks/{notebook_id}/research/{research_id}/modify",
        json={
            "plan": {
                "iteration": 1,
                "queries": [{"query": "q", "engine": "Web", "priority": 1, "reason": "r"}],
                "reasoning": "why",
                "estimated_results": 1,
            }
        },
    )
    assert modify.status_code == 200
    assert modify.json()["status"] == ResearchStatus.SEARCHING.value

    # Skip should advance iteration or complete
    await db_session.execute(
        sa.update(ResearchSession)
        .where(ResearchSession.id == research_id)
        .values(status=ResearchStatus.WAITING_USER)
    )
    await db_session.commit()

    skipped = await client.post(f"/v1/notebooks/{notebook_id}/research/{research_id}/skip")
    assert skipped.status_code == 200
    payload = skipped.json()
    assert payload["current_iteration"] == 2
    assert payload["status"] in {ResearchStatus.PLANNING.value, ResearchStatus.COMPLETED.value}

    # Finish transitions to completed
    finish = await client.post(f"/v1/notebooks/{notebook_id}/research/{research_id}/finish")
    assert finish.status_code == 200
    assert finish.json()["status"] == ResearchStatus.COMPLETED.value

    # Cancel is rejected once completed
    cancel = await client.post(f"/v1/notebooks/{notebook_id}/research/{research_id}/cancel")
    assert cancel.status_code == 400

    # Export rejects missing report
    export_missing = await client.post(
        f"/v1/notebooks/{notebook_id}/research/{research_id}/export",
        json={"export_type": "source"},
    )
    assert export_missing.status_code == 400

    # Add report and export to note + source
    research = await db_session.get(ResearchSession, research_id)
    assert research is not None
    research.final_report = "Final report"
    research.aggregated_results = [{"title": "T", "url": "https://example.com", "snippet": "S"}]
    await db_session.commit()

    note_resp = await client.post(
        f"/v1/notebooks/{notebook_id}/research/{research_id}/export",
        json={"export_type": "note"},
    )
    assert note_resp.status_code == 200
    assert note_resp.json()["note_id"]

    before = tuple(await app.state.vector_store.entries())
    source_resp = await client.post(
        f"/v1/notebooks/{notebook_id}/research/{research_id}/export",
        json={"export_type": "source", "include_results": True},
    )
    assert source_resp.status_code == 200
    exported = source_resp.json()
    assert exported["source_id"]

    after = tuple(await app.state.vector_store.entries())
    assert len(after) > len(before)
    assert any(entry.source_id == exported["source_id"] for entry in after)

    bad = await client.post(
        f"/v1/notebooks/{notebook_id}/research/{research_id}/export",
        json={"export_type": "nope"},
    )
    assert bad.status_code == 400


@pytest.mark.asyncio
async def test_research_stream_emits_done_for_completed_session(client, db_session) -> None:
    notebook_resp = await client.post("/v1/notebooks", json={"name": "Research Stream"})
    assert notebook_resp.status_code == 201
    notebook_id = notebook_resp.json()["id"]

    rs = ResearchSession(
        notebook_id=notebook_id,
        topic="StreamTopic",
        status=ResearchStatus.COMPLETED,
        current_iteration=1,
        max_iterations=1,
        aggregated_results=[],
        final_report="done",
    )
    db_session.add(rs)
    await db_session.commit()
    await db_session.refresh(rs)

    seen_done = False
    async with client.stream(
        "GET",
        f"/v1/notebooks/{notebook_id}/research/{rs.id}/stream",
    ) as response:
        assert response.status_code == 200
        async for line in response.aiter_lines():
            if line.startswith("event: done"):
                seen_done = True
                break

    assert seen_done is True
