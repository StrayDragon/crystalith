"""Research API endpoints for deep research sessions."""

from __future__ import annotations

import asyncio
import datetime
import json
from collections.abc import AsyncGenerator
from typing import Any

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query, Response, status
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from cl_logs.logging import get_logger

from crystalith.config import Settings
from crystalith.db import (
    Notebook,
    ResearchSession,
    ResearchStatus,
    ResearchStep,
    ResearchStepStatus,
    ResearchStepType,
)
from crystalith.search import SearXNGSearcher

from .deps import get_db_session, get_settings


log = get_logger(__name__)


# =============================================================================
# SSE Helpers
# =============================================================================


def _sse_event(event: str, data: dict) -> str:
    """Format a Server-Sent Event."""
    return f"event: {event}\ndata: {json.dumps(data, ensure_ascii=False)}\n\n"


router = APIRouter(prefix="/v1/notebooks/{notebook_id}/research", tags=["research"])


# =============================================================================
# Pydantic Models
# =============================================================================


class SearchQuery(BaseModel):
    """A single search query in a search plan."""

    model_config = ConfigDict(from_attributes=True)

    query: str = Field(..., description="Search query string")
    engine: str = Field("Web", description="Search engine: Web, Scholar, Docs")
    priority: int = Field(1, ge=1, le=3, description="Priority: 1=high, 2=medium, 3=low")
    reason: str = Field("", description="Reason for this query")


class SearchPlan(BaseModel):
    """A search plan for one iteration."""

    model_config = ConfigDict(from_attributes=True)

    iteration: int = Field(..., ge=1, description="Iteration number")
    queries: list[SearchQuery] = Field(default_factory=list, description="Queries to execute")
    reasoning: str = Field("", description="Agent reasoning for this plan")
    estimated_results: int = Field(10, ge=0, description="Estimated number of results")


class ResearchStepResponse(BaseModel):
    """Response model for a research step."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    session_id: int
    iteration: int
    type: ResearchStepType
    input_data: dict[str, Any] | None
    output_data: dict[str, Any] | None
    status: ResearchStepStatus
    created_at: datetime.datetime


class ResearchSessionCreate(BaseModel):
    """Request model to create a research session."""

    topic: str = Field(..., min_length=1, max_length=500, description="Research topic")
    max_iterations: int = Field(4, ge=1, le=10, description="Maximum iterations")


class ResearchSessionResponse(BaseModel):
    """Response model for a research session."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    notebook_id: int
    topic: str
    status: ResearchStatus
    current_iteration: int
    max_iterations: int
    aggregated_results: list[dict[str, Any]] | None
    final_report: str | None
    created_at: datetime.datetime
    updated_at: datetime.datetime
    steps: list[ResearchStepResponse] = Field(default_factory=list)


class ResearchSessionListItem(BaseModel):
    """Simplified response for listing research sessions."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    notebook_id: int
    topic: str
    status: ResearchStatus
    current_iteration: int
    max_iterations: int
    result_count: int = Field(0, description="Number of aggregated results")
    created_at: datetime.datetime
    updated_at: datetime.datetime


# =============================================================================
# Helper Functions
# =============================================================================


async def _get_notebook(session: AsyncSession, notebook_id: int) -> Notebook:
    """Get notebook or raise 404."""
    notebook = await session.get(Notebook, notebook_id)
    if notebook is None:
        raise HTTPException(status_code=404, detail="Notebook not found")
    return notebook


async def _get_research_session(
    session: AsyncSession,
    notebook_id: int,
    research_id: int,
) -> ResearchSession:
    """Get research session or raise 404."""
    research = await session.get(ResearchSession, research_id)
    if research is None or research.notebook_id != notebook_id:
        raise HTTPException(status_code=404, detail="Research session not found")
    return research


# =============================================================================
# API Endpoints
# =============================================================================


@router.post("", response_model=ResearchSessionResponse, status_code=status.HTTP_201_CREATED)
async def create_research_session(
    notebook_id: int,
    payload: ResearchSessionCreate,
    session: AsyncSession = Depends(get_db_session),
) -> ResearchSessionResponse:
    """Create a new deep research session."""
    await _get_notebook(session, notebook_id)

    research = ResearchSession(
        notebook_id=notebook_id,
        topic=payload.topic,
        status=ResearchStatus.PLANNING,
        current_iteration=1,
        max_iterations=payload.max_iterations,
    )
    session.add(research)
    await session.commit()
    await session.refresh(research)

    log.info(
        "research session created",
        notebook_id=notebook_id,
        research_id=research.id,
        topic=payload.topic[:50],
    )

    return ResearchSessionResponse.model_validate(research)


@router.get("", response_model=list[ResearchSessionListItem])
async def list_research_sessions(
    notebook_id: int,
    session: AsyncSession = Depends(get_db_session),
    offset: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    status_filter: ResearchStatus | None = Query(None, alias="status"),
) -> list[ResearchSessionListItem]:
    """List research sessions for a notebook."""
    await _get_notebook(session, notebook_id)

    query = select(ResearchSession).where(ResearchSession.notebook_id == notebook_id)

    if status_filter is not None:
        query = query.where(ResearchSession.status == status_filter)

    query = query.order_by(ResearchSession.updated_at.desc()).offset(offset).limit(limit)

    result = await session.execute(query)
    sessions = result.scalars().all()

    items: list[ResearchSessionListItem] = []
    for rs in sessions:
        result_count = len(rs.aggregated_results) if rs.aggregated_results else 0
        items.append(
            ResearchSessionListItem(
                id=rs.id,
                notebook_id=rs.notebook_id,
                topic=rs.topic,
                status=rs.status,
                current_iteration=rs.current_iteration,
                max_iterations=rs.max_iterations,
                result_count=result_count,
                created_at=rs.created_at,
                updated_at=rs.updated_at,
            )
        )

    return items


@router.get("/{research_id}", response_model=ResearchSessionResponse)
async def get_research_session(
    notebook_id: int,
    research_id: int,
    session: AsyncSession = Depends(get_db_session),
) -> ResearchSessionResponse:
    """Get details of a research session including all steps."""
    research = await _get_research_session(session, notebook_id, research_id)
    return ResearchSessionResponse.model_validate(research)


@router.delete("/{research_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_research_session(
    notebook_id: int,
    research_id: int,
    session: AsyncSession = Depends(get_db_session),
) -> Response:
    """Delete or cancel a research session."""
    research = await _get_research_session(session, notebook_id, research_id)

    # If still running, mark as cancelled first
    if research.status not in (ResearchStatus.COMPLETED, ResearchStatus.CANCELLED):
        research.status = ResearchStatus.CANCELLED
        await session.commit()

    await session.delete(research)
    await session.commit()

    log.info(
        "research session deleted",
        notebook_id=notebook_id,
        research_id=research_id,
    )

    return Response(status_code=status.HTTP_204_NO_CONTENT)


# =============================================================================
# Interaction Endpoints (Placeholders for Phase 3)
# =============================================================================


class ApproveRequest(BaseModel):
    """Request to approve a search plan."""

    feedback: str | None = Field(None, description="Optional feedback on the plan")


class ModifyRequest(BaseModel):
    """Request to modify a search plan."""

    plan: SearchPlan = Field(..., description="Modified search plan")


@router.post("/{research_id}/approve", response_model=ResearchSessionResponse)
async def approve_search_plan(
    notebook_id: int,
    research_id: int,
    payload: ApproveRequest,
    session: AsyncSession = Depends(get_db_session),
) -> ResearchSessionResponse:
    """Approve the current search plan and continue research."""
    research = await _get_research_session(session, notebook_id, research_id)

    if research.status != ResearchStatus.WAITING_USER:
        raise HTTPException(
            status_code=400,
            detail=f"Cannot approve: session is in '{research.status.value}' state",
        )

    # Record user approval as a step
    step = ResearchStep(
        session_id=research.id,
        iteration=research.current_iteration,
        type=ResearchStepType.USER_INPUT,
        input_data={"action": "approve", "feedback": payload.feedback},
        output_data=None,
        status=ResearchStepStatus.COMPLETED,
    )
    session.add(step)

    # Transition to searching
    research.status = ResearchStatus.SEARCHING
    await session.commit()
    await session.refresh(research)

    log.info(
        "search plan approved",
        research_id=research_id,
        iteration=research.current_iteration,
    )

    return ResearchSessionResponse.model_validate(research)


@router.post("/{research_id}/modify", response_model=ResearchSessionResponse)
async def modify_search_plan(
    notebook_id: int,
    research_id: int,
    payload: ModifyRequest,
    session: AsyncSession = Depends(get_db_session),
) -> ResearchSessionResponse:
    """Modify the current search plan."""
    research = await _get_research_session(session, notebook_id, research_id)

    if research.status != ResearchStatus.WAITING_USER:
        raise HTTPException(
            status_code=400,
            detail=f"Cannot modify: session is in '{research.status.value}' state",
        )

    # Record modification as a step
    step = ResearchStep(
        session_id=research.id,
        iteration=research.current_iteration,
        type=ResearchStepType.USER_INPUT,
        input_data={"action": "modify", "plan": payload.plan.model_dump()},
        output_data=None,
        status=ResearchStepStatus.COMPLETED,
    )
    session.add(step)

    # Transition to searching
    research.status = ResearchStatus.SEARCHING
    await session.commit()
    await session.refresh(research)

    log.info(
        "search plan modified",
        research_id=research_id,
        iteration=research.current_iteration,
    )

    return ResearchSessionResponse.model_validate(research)


@router.post("/{research_id}/skip", response_model=ResearchSessionResponse)
async def skip_iteration(
    notebook_id: int,
    research_id: int,
    session: AsyncSession = Depends(get_db_session),
) -> ResearchSessionResponse:
    """Skip the current iteration."""
    research = await _get_research_session(session, notebook_id, research_id)

    if research.status != ResearchStatus.WAITING_USER:
        raise HTTPException(
            status_code=400,
            detail=f"Cannot skip: session is in '{research.status.value}' state",
        )

    # Record skip as a step
    step = ResearchStep(
        session_id=research.id,
        iteration=research.current_iteration,
        type=ResearchStepType.USER_INPUT,
        input_data={"action": "skip"},
        output_data=None,
        status=ResearchStepStatus.SKIPPED,
    )
    session.add(step)

    # Move to next iteration or finish
    if research.current_iteration >= research.max_iterations:
        research.status = ResearchStatus.COMPLETED
    else:
        research.current_iteration += 1
        research.status = ResearchStatus.PLANNING

    await session.commit()
    await session.refresh(research)

    log.info(
        "iteration skipped",
        research_id=research_id,
        new_iteration=research.current_iteration,
        new_status=research.status.value,
    )

    return ResearchSessionResponse.model_validate(research)


@router.post("/{research_id}/finish", response_model=ResearchSessionResponse)
async def finish_research(
    notebook_id: int,
    research_id: int,
    session: AsyncSession = Depends(get_db_session),
) -> ResearchSessionResponse:
    """Finish research early and generate report."""
    research = await _get_research_session(session, notebook_id, research_id)

    if research.status in (ResearchStatus.COMPLETED, ResearchStatus.CANCELLED):
        raise HTTPException(
            status_code=400,
            detail=f"Cannot finish: session is already '{research.status.value}'",
        )

    # Record finish as a step
    step = ResearchStep(
        session_id=research.id,
        iteration=research.current_iteration,
        type=ResearchStepType.USER_INPUT,
        input_data={"action": "finish"},
        output_data=None,
        status=ResearchStepStatus.COMPLETED,
    )
    session.add(step)

    # Mark as completed
    research.status = ResearchStatus.COMPLETED
    await session.commit()
    await session.refresh(research)

    log.info(
        "research finished early",
        research_id=research_id,
        iteration=research.current_iteration,
    )

    return ResearchSessionResponse.model_validate(research)


# =============================================================================
# Research Execution
# =============================================================================


async def _run_research_background(
    session_id: int,
    notebook_id: int,
    topic: str,
    max_iterations: int,
    settings: Settings,
) -> None:
    """Run research graph in background."""
    from crystalith.db import create_db_manager
    from crystalith.research import ResearchDeps, run_research_graph

    log.info("starting background research", session_id=session_id)

    db_manager = create_db_manager(settings.database.url)
    searcher = SearXNGSearcher.from_settings(settings)

    try:
        async with db_manager.got_manual_session() as db_session:
            deps = ResearchDeps(
                settings=settings,
                session=db_session,
                searcher=searcher,
            )

            result = await run_research_graph(
                session_id=session_id,
                notebook_id=notebook_id,
                topic=topic,
                deps=deps,
                max_iterations=max_iterations,
            )

            log.info(
                "background research completed",
                session_id=session_id,
                result=result,
            )

    except Exception as error:
        log.error("background research failed", session_id=session_id, error=str(error))
        # Update session status to failed
        async with db_manager.got_manual_session() as db_session:
            research = await db_session.get(ResearchSession, session_id)
            if research:
                research.status = ResearchStatus.CANCELLED
                await db_session.commit()

    finally:
        await db_manager.close()


@router.post("/{research_id}/start", response_model=ResearchSessionResponse)
async def start_research(
    notebook_id: int,
    research_id: int,
    background_tasks: BackgroundTasks,
    session: AsyncSession = Depends(get_db_session),
    settings: Settings = Depends(get_settings),
) -> ResearchSessionResponse:
    """Start executing the research graph."""
    research = await _get_research_session(session, notebook_id, research_id)

    if research.status != ResearchStatus.PLANNING:
        raise HTTPException(
            status_code=400,
            detail=f"Cannot start: session is in '{research.status.value}' state",
        )

    log.info(
        "starting research",
        notebook_id=notebook_id,
        research_id=research_id,
        topic=research.topic[:50],
    )

    # Start background task
    background_tasks.add_task(
        _run_research_background,
        session_id=research.id,
        notebook_id=notebook_id,
        topic=research.topic,
        max_iterations=research.max_iterations,
        settings=settings,
    )

    return ResearchSessionResponse.model_validate(research)


# =============================================================================
# SSE Stream Endpoint
# =============================================================================


@router.get(
    "/{research_id}/stream",
    responses={
        200: {
            "description": "SSE stream of research progress",
            "content": {"text/event-stream": {}},
        }
    },
)
async def stream_research_progress(
    notebook_id: int,
    research_id: int,
    session: AsyncSession = Depends(get_db_session),
) -> StreamingResponse:
    """Stream research progress using Server-Sent Events.

    Events:
    - `status`: Status update `{"status": "...", "iteration": n}`
    - `plan_ready`: Search plan ready `{"plan": {...}}`
    - `search_progress`: Search progress `{"query": "...", "completed": n, "total": m}`
    - `search_result`: New result `{"title": "...", "url": "..."}`
    - `analysis`: Analysis complete `{"summary": "...", "coverage": 0.x}`
    - `report`: Final report `{"report": "..."}`
    - `done`: Research complete `{"total_results": n}`
    - `error`: Error `{"message": "..."}`
    """
    research = await _get_research_session(session, notebook_id, research_id)

    async def generate_stream() -> AsyncGenerator[str, None]:
        """Generate SSE events by polling research status."""
        last_status = research.status
        last_iteration = research.current_iteration
        last_step_count = len(research.steps) if research.steps else 0

        # Send initial status
        yield _sse_event("status", {
            "status": research.status.value,
            "iteration": research.current_iteration,
            "topic": research.topic,
        })

        # Poll for updates
        poll_interval = 1.0  # seconds
        max_polls = 600  # 10 minutes max

        for _ in range(max_polls):
            await asyncio.sleep(poll_interval)

            # Refresh research session
            await session.refresh(research)

            current_status = research.status
            current_iteration = research.current_iteration
            current_step_count = len(research.steps) if research.steps else 0

            # Check for status change
            if current_status != last_status:
                yield _sse_event("status", {
                    "status": current_status.value,
                    "iteration": current_iteration,
                })
                last_status = current_status

            # Check for iteration change
            if current_iteration != last_iteration:
                yield _sse_event("status", {
                    "status": current_status.value,
                    "iteration": current_iteration,
                })
                last_iteration = current_iteration

            # Check for new steps
            if current_step_count > last_step_count:
                for step in research.steps[last_step_count:]:
                    if step.type == ResearchStepType.PLAN and step.output_data:
                        yield _sse_event("plan_ready", {
                            "plan": step.output_data,
                            "iteration": step.iteration,
                        })
                    elif step.type == ResearchStepType.SEARCH and step.output_data:
                        yield _sse_event("search_progress", {
                            "iteration": step.iteration,
                            "result_count": step.output_data.get("result_count", 0),
                            "new_results": step.output_data.get("new_results", 0),
                        })
                    elif step.type == ResearchStepType.ANALYZE and step.output_data:
                        yield _sse_event("analysis", {
                            "iteration": step.iteration,
                            "summary": step.output_data.get("summary", ""),
                            "coverage": step.output_data.get("coverage", 0),
                            "need_more_search": step.output_data.get("need_more_search", False),
                        })
                    elif step.type == ResearchStepType.SUMMARY:
                        yield _sse_event("report", {
                            "report_length": step.output_data.get("report_length", 0) if step.output_data else 0,
                        })

                last_step_count = current_step_count

            # Check for completion
            if current_status in (ResearchStatus.COMPLETED, ResearchStatus.CANCELLED):
                total_results = len(research.aggregated_results) if research.aggregated_results else 0
                yield _sse_event("done", {
                    "status": current_status.value,
                    "total_results": total_results,
                    "has_report": bool(research.final_report),
                })
                break

            # Check for waiting state
            if current_status == ResearchStatus.WAITING_USER:
                yield _sse_event("waiting", {
                    "status": "waiting_user",
                    "iteration": current_iteration,
                    "message": "等待您确认搜索计划",
                })

    return StreamingResponse(
        generate_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )
