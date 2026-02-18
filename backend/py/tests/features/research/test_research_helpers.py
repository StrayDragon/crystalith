from __future__ import annotations

import datetime

import pytest

from crystalith.features.research import api as research_api
from crystalith.shared.db import Notebook, ResearchSession, ResearchStep
from crystalith.shared.types import ResearchStatus, ResearchStepStatus, ResearchStepType


def test_sse_event_formats_json_payload() -> None:
    rendered = research_api._sse_event("status", {"ok": True, "n": 1})
    assert rendered.startswith("event: status\n")
    assert "\ndata: " in rendered
    assert rendered.endswith("\n\n")


def test_infer_resume_state_handles_step_types_without_database() -> None:
    base = ResearchSession(
        notebook_id=1,
        topic="t",
        status=ResearchStatus.CANCELLED,
        current_iteration=1,
        max_iterations=2,
    )
    assert research_api._infer_resume_state(base) == (ResearchStatus.PLANNING, 1)

    base.steps = [
        ResearchStep(
            session_id=1,
            iteration=1,
            type=ResearchStepType.PLAN,
            input_data=None,
            output_data=None,
            status=ResearchStepStatus.COMPLETED,
        )
    ]
    assert research_api._infer_resume_state(base) == (ResearchStatus.WAITING_USER, 1)

    base.steps = [
        ResearchStep(
            session_id=1,
            iteration=1,
            type=ResearchStepType.USER_INPUT,
            input_data={"action": "cancel"},
            output_data=None,
            status=ResearchStepStatus.COMPLETED,
        )
    ]
    assert research_api._infer_resume_state(base) == (None, 1)

    base.steps = [
        ResearchStep(
            session_id=1,
            iteration=1,
            type=ResearchStepType.USER_INPUT,
            input_data={"action": "finish"},
            output_data=None,
            status=ResearchStepStatus.COMPLETED,
        )
    ]
    assert research_api._infer_resume_state(base) == (ResearchStatus.COMPLETED, 1)

    base.steps = [
        ResearchStep(
            session_id=1,
            iteration=1,
            type=ResearchStepType.USER_INPUT,
            input_data={"action": "skip"},
            output_data=None,
            status=ResearchStepStatus.SKIPPED,
        )
    ]
    assert research_api._infer_resume_state(base) == (ResearchStatus.PLANNING, 1)

    base.current_iteration = 2
    base.max_iterations = 2
    assert research_api._infer_resume_state(base) == (ResearchStatus.COMPLETED, 2)

    base.steps = [
        ResearchStep(
            session_id=1,
            iteration=1,
            type=ResearchStepType.USER_INPUT,
            input_data={"action": "modify", "plan": {"queries": [{"query": "q"}]}},
            output_data=None,
            status=ResearchStepStatus.COMPLETED,
        )
    ]
    assert research_api._infer_resume_state(base) == (ResearchStatus.SEARCHING, 1)

    base.steps = [
        ResearchStep(
            session_id=1,
            iteration=1,
            type=ResearchStepType.SEARCH,
            input_data=None,
            output_data=None,
            status=ResearchStepStatus.COMPLETED,
        )
    ]
    assert research_api._infer_resume_state(base) == (ResearchStatus.ANALYZING, 1)

    base.max_iterations = 4
    base.steps = [
        ResearchStep(
            session_id=1,
            iteration=1,
            type=ResearchStepType.ANALYZE,
            input_data=None,
            output_data={"need_more_search": True},
            status=ResearchStepStatus.COMPLETED,
        )
    ]
    assert research_api._infer_resume_state(base) == (ResearchStatus.PLANNING, 2)

    base.steps = [
        ResearchStep(
            session_id=1,
            iteration=3,
            type=ResearchStepType.ANALYZE,
            input_data=None,
            output_data={"need_more_search": False},
            status=ResearchStepStatus.COMPLETED,
        )
    ]
    assert research_api._infer_resume_state(base) == (ResearchStatus.ANALYZING, 3)

    base.steps = [
        ResearchStep(
            session_id=1,
            iteration=2,
            type=ResearchStepType.SUMMARY,
            input_data=None,
            output_data=None,
            status=ResearchStepStatus.COMPLETED,
        )
    ]
    assert research_api._infer_resume_state(base) == (ResearchStatus.COMPLETED, 2)


@pytest.mark.asyncio
async def test_lock_helpers_acquire_extend_release_cleanup(db_session) -> None:
    now = datetime.datetime.now(datetime.UTC).replace(tzinfo=None)

    notebook = Notebook(name="Locks Notebook")
    db_session.add(notebook)
    await db_session.flush()

    research = ResearchSession(
        notebook_id=notebook.id,
        topic="locks",
        status=ResearchStatus.PLANNING,
        current_iteration=1,
        max_iterations=1,
        locked_at=now,
        lock_expires_at=now + datetime.timedelta(seconds=60),
    )
    db_session.add(research)
    await db_session.commit()
    await db_session.refresh(research)

    # Still locked -> cannot acquire.
    assert await research_api.acquire_lock(db_session, research, timeout_seconds=1) is False

    # Expire and re-acquire.
    research.lock_expires_at = datetime.datetime.now(datetime.UTC).replace(tzinfo=None) - datetime.timedelta(seconds=1)
    await db_session.commit()
    assert await research_api.acquire_lock(db_session, research, timeout_seconds=1) is True

    assert await research_api.extend_lock(db_session, research, timeout_seconds=5) is True
    assert await research_api.release_lock(db_session, research) is None
    assert research.locked_at is None

    # cleanup should cancel active sessions when lock expired.
    expired = ResearchSession(
        notebook_id=notebook.id,
        topic="expired",
        status=ResearchStatus.SEARCHING,
        current_iteration=1,
        max_iterations=1,
        locked_at=now,
        lock_expires_at=now - datetime.timedelta(seconds=1),
    )
    db_session.add(expired)
    await db_session.commit()

    cleaned = await research_api.check_and_cleanup_expired_locks(db_session)
    assert cleaned >= 1

    refreshed = await db_session.get(ResearchSession, expired.id)
    assert refreshed is not None
    assert refreshed.locked_at is None
    assert refreshed.lock_expires_at is None
    assert refreshed.status == ResearchStatus.CANCELLED
