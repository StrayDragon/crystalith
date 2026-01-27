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

from crystalith.shared.ai.interfaces import EmbeddingProvider
from crystalith.shared.config import Settings
from crystalith.shared.db import Notebook, ResearchSession, ResearchStep
from crystalith.shared.types import ResearchStatus, ResearchStepStatus, ResearchStepType
from crystalith.shared.search import SearXNGSearcher
from crystalith.shared.vector_storage import VectorStore

from crystalith.shared.deps import get_db_session, get_embedding_provider, get_settings, get_vector_store


log = get_logger(__name__)


# =============================================================================
# Lock Management
# =============================================================================

# Lock timeout in seconds (10 minutes)
LOCK_TIMEOUT_SECONDS = 600


async def acquire_lock(
    session: AsyncSession,
    research: ResearchSession,
    timeout_seconds: int = LOCK_TIMEOUT_SECONDS,
) -> bool:
    """Acquire a lock on the research session.

    Returns True if lock acquired, False if already locked by another process.
    """
    now = datetime.datetime.now(datetime.UTC)

    # Check if there's an existing valid lock
    if research.locked_at and research.lock_expires_at:
        if research.lock_expires_at > now:
            log.warning(
                "research session already locked",
                session_id=research.id,
                locked_at=research.locked_at.isoformat(),
                expires_at=research.lock_expires_at.isoformat(),
            )
            return False

    # Acquire lock
    research.locked_at = now
    research.lock_expires_at = now + datetime.timedelta(seconds=timeout_seconds)
    await session.commit()

    log.info(
        "lock acquired",
        session_id=research.id,
        expires_at=research.lock_expires_at.isoformat(),
    )
    return True


async def release_lock(session: AsyncSession, research: ResearchSession) -> None:
    """Release the lock on the research session."""
    research.locked_at = None
    research.lock_expires_at = None
    await session.commit()

    log.info("lock released", session_id=research.id)


async def extend_lock(
    session: AsyncSession,
    research: ResearchSession,
    timeout_seconds: int = LOCK_TIMEOUT_SECONDS,
) -> bool:
    """Extend the lock timeout.

    Returns True if extended, False if lock was not held.
    """
    now = datetime.datetime.now(datetime.UTC)

    if not research.locked_at:
        return False

    research.lock_expires_at = now + datetime.timedelta(seconds=timeout_seconds)
    await session.commit()
    return True


async def check_and_cleanup_expired_locks(session: AsyncSession) -> int:
    """Clean up expired locks. Returns count of cleaned locks."""
    now = datetime.datetime.now(datetime.UTC)

    # Find sessions with expired locks
    stmt = select(ResearchSession).where(
        ResearchSession.lock_expires_at.isnot(None),
        ResearchSession.lock_expires_at < now,
    )
    result = await session.execute(stmt)
    expired_sessions = result.scalars().all()

    count = 0
    for research in expired_sessions:
        research.locked_at = None
        research.lock_expires_at = None

        # If session was in an active state, mark it as cancelled
        if research.status in (
            ResearchStatus.PLANNING,
            ResearchStatus.SEARCHING,
            ResearchStatus.ANALYZING,
            ResearchStatus.WAITING_USER,
        ):
            research.status = ResearchStatus.CANCELLED
            log.warning(
                "cancelled research due to expired lock",
                session_id=research.id,
            )

        count += 1

    if count > 0:
        await session.commit()
        log.info("cleaned up expired locks", count=count)

    return count


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


@router.post("/{research_id}/cancel", response_model=ResearchSessionResponse)
async def cancel_research(
    notebook_id: int,
    research_id: int,
    session: AsyncSession = Depends(get_db_session),
) -> ResearchSessionResponse:
    """Cancel an ongoing research session."""
    research = await _get_research_session(session, notebook_id, research_id)

    if research.status in (ResearchStatus.COMPLETED, ResearchStatus.CANCELLED):
        raise HTTPException(
            status_code=400,
            detail=f"Cannot cancel: session is already '{research.status.value}'",
        )

    # Record cancellation as a step
    step = ResearchStep(
        session_id=research.id,
        iteration=research.current_iteration,
        type=ResearchStepType.USER_INPUT,
        input_data={"action": "cancel"},
        output_data=None,
        status=ResearchStepStatus.COMPLETED,
    )
    session.add(step)

    # Mark as cancelled and release any lock
    research.status = ResearchStatus.CANCELLED
    research.locked_at = None
    research.lock_expires_at = None
    await session.commit()
    await session.refresh(research)

    log.info(
        "research cancelled",
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
    """Run research graph in background with lock management."""
    from crystalith.shared.db import create_db_manager
    from . import ResearchDeps, run_research_graph

    log.info("starting background research", session_id=session_id)

    db_manager = create_db_manager(settings.database.url)
    searcher = SearXNGSearcher.from_settings(settings)

    try:
        async with db_manager.got_manual_session() as db_session:
            # Acquire lock
            research = await db_session.get(ResearchSession, session_id)
            if not research:
                log.error("research session not found", session_id=session_id)
                return

            if not await acquire_lock(db_session, research):
                log.error("failed to acquire lock", session_id=session_id)
                return

            try:
                deps = ResearchDeps(
                    settings=settings,
                    session=db_session,
                    searcher=searcher,
                )

                # Start a background task to extend lock periodically
                lock_extension_task = asyncio.create_task(
                    _extend_lock_periodically(db_manager, session_id)
                )

                try:
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
                finally:
                    lock_extension_task.cancel()
                    try:
                        await lock_extension_task
                    except asyncio.CancelledError:
                        pass

            finally:
                # Release lock
                await db_session.refresh(research)
                await release_lock(db_session, research)

    except Exception as error:
        log.error("background research failed", session_id=session_id, error=str(error))
        # Update session status to failed
        async with db_manager.got_manual_session() as db_session:
            research = await db_session.get(ResearchSession, session_id)
            if research:
                research.status = ResearchStatus.CANCELLED
                research.locked_at = None
                research.lock_expires_at = None
                await db_session.commit()

    finally:
        await db_manager.close()


async def _extend_lock_periodically(db_manager, session_id: int) -> None:
    """Periodically extend the lock to prevent timeout during long operations."""
    from crystalith.shared.db import create_db_manager

    # Extend lock every 5 minutes (half of the 10-minute timeout)
    extension_interval = 300

    while True:
        await asyncio.sleep(extension_interval)
        try:
            async with db_manager.got_manual_session() as db_session:
                research = await db_session.get(ResearchSession, session_id)
                if research and research.locked_at:
                    await extend_lock(db_session, research)
                    log.debug("lock extended", session_id=session_id)
        except Exception as e:
            log.warning("failed to extend lock", session_id=session_id, error=str(e))


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

        # Send initial thinking event
        yield _sse_event("thinking", {
            "type": "start",
            "message": f"🚀 开始深度研究「{research.topic}」",
            "iteration": research.current_iteration,
        })

        # Poll for updates
        poll_interval = 0.5  # Faster polling for more responsive updates
        max_polls = 1200  # 10 minutes max
        heartbeat_interval = 30  # Send heartbeat every 30 seconds
        polls_since_heartbeat = 0

        for poll_count in range(max_polls):
            await asyncio.sleep(poll_interval)
            polls_since_heartbeat += 1

            # Send heartbeat to keep connection alive
            if polls_since_heartbeat * poll_interval >= heartbeat_interval:
                yield _sse_event("heartbeat", {"timestamp": datetime.datetime.now(datetime.UTC).isoformat()})
                polls_since_heartbeat = 0

            # Expire all to force fresh data from database
            session.expire(research)
            # Re-fetch to get fresh data including steps
            await session.refresh(research)
            # Explicitly access steps to trigger lazy load
            _ = research.steps

            current_status = research.status
            current_iteration = research.current_iteration
            current_step_count = len(research.steps) if research.steps else 0

            # Check for status change and emit thinking events
            if current_status != last_status:
                yield _sse_event("status", {
                    "status": current_status.value,
                    "iteration": current_iteration,
                })

                # Generate thinking event for status change
                status_messages = {
                    ResearchStatus.PLANNING: f"🔍 正在分析主题，生成第 {current_iteration} 轮搜索策略...",
                    ResearchStatus.SEARCHING: "🌐 正在执行搜索查询...",
                    ResearchStatus.ANALYZING: "📊 正在分析搜索结果...",
                    ResearchStatus.WAITING_USER: "⏳ 等待确认搜索计划",
                    ResearchStatus.COMPLETED: "✅ 研究完成",
                }
                if current_status in status_messages:
                    yield _sse_event("thinking", {
                        "type": current_status.value,
                        "message": status_messages[current_status],
                        "iteration": current_iteration,
                    })

                last_status = current_status

            # Check for iteration change
            if current_iteration != last_iteration:
                yield _sse_event("status", {
                    "status": current_status.value,
                    "iteration": current_iteration,
                })
                yield _sse_event("thinking", {
                    "type": "new_iteration",
                    "message": f"🔄 开始第 {current_iteration} 轮研究",
                    "iteration": current_iteration,
                })
                last_iteration = current_iteration

            # Check for new steps and emit detailed thinking events
            if current_step_count > last_step_count:
                for step in research.steps[last_step_count:]:
                    if step.type == ResearchStepType.PLAN and step.output_data:
                        queries = step.output_data.get("queries", [])
                        reasoning = step.output_data.get("reasoning", "")

                        # Emit reasoning as thinking
                        if reasoning:
                            yield _sse_event("thinking", {
                                "type": "reasoning",
                                "message": f"💭 {reasoning}",
                                "iteration": step.iteration,
                            })

                        yield _sse_event("thinking", {
                            "type": "plan_generated",
                            "message": f"📋 已生成 {len(queries)} 个搜索查询",
                            "iteration": step.iteration,
                            "queries": [q.get("query", "") for q in queries],
                        })

                        yield _sse_event("plan_ready", {
                            "plan": step.output_data,
                            "iteration": step.iteration,
                        })

                    elif step.type == ResearchStepType.SEARCH and step.output_data:
                        result_count = step.output_data.get("result_count", 0)
                        new_results = step.output_data.get("new_results", 0)

                        yield _sse_event("thinking", {
                            "type": "search_complete",
                            "message": f"🔎 搜索完成，获取 {result_count} 条结果，新增 {new_results} 条",
                            "iteration": step.iteration,
                        })

                        yield _sse_event("search_progress", {
                            "iteration": step.iteration,
                            "result_count": result_count,
                            "new_results": new_results,
                        })

                    elif step.type == ResearchStepType.ANALYZE and step.output_data:
                        summary = step.output_data.get("summary", "")
                        coverage = step.output_data.get("coverage", 0)
                        need_more = step.output_data.get("need_more_search", False)

                        yield _sse_event("thinking", {
                            "type": "analysis_complete",
                            "message": f"📈 分析完成，覆盖度 {int(coverage * 100)}%",
                            "iteration": step.iteration,
                        })

                        if summary:
                            yield _sse_event("thinking", {
                                "type": "insight",
                                "message": f"💡 {summary}",
                                "iteration": step.iteration,
                            })

                        if need_more:
                            yield _sse_event("thinking", {
                                "type": "decision",
                                "message": "🔄 需要更多搜索，准备下一轮...",
                                "iteration": step.iteration,
                            })

                        yield _sse_event("analysis", {
                            "iteration": step.iteration,
                            "summary": summary,
                            "coverage": coverage,
                            "need_more_search": need_more,
                        })

                    elif step.type == ResearchStepType.SUMMARY:
                        report_length = step.output_data.get("report_length", 0) if step.output_data else 0

                        yield _sse_event("thinking", {
                            "type": "report_complete",
                            "message": f"📝 报告生成完成，共 {report_length} 字",
                            "iteration": step.iteration,
                        })

                        yield _sse_event("report", {
                            "report_length": report_length,
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


# =============================================================================
# Export Endpoint
# =============================================================================


class ExportResearchRequest(BaseModel):
    """Request model for exporting research results."""

    export_type: str = Field("source", description="Export type: 'source' or 'note'")
    include_report: bool = Field(True, description="Include final report")
    include_results: bool = Field(False, description="Include aggregated results as links")


class ExportResearchResponse(BaseModel):
    """Response model for export operation."""

    success: bool
    message: str
    source_id: int | None = None
    note_id: int | None = None


@router.post("/{research_id}/export", response_model=ExportResearchResponse)
async def export_research(
    notebook_id: int,
    research_id: int,
    payload: ExportResearchRequest,
    session: AsyncSession = Depends(get_db_session),
    settings: Settings = Depends(get_settings),
    embedder: EmbeddingProvider = Depends(get_embedding_provider),
    vector_store: VectorStore = Depends(get_vector_store),
) -> ExportResearchResponse:
    """Export research report to a source or note.

    - export_type='source': Creates a new markdown source with the report
    - export_type='note': Creates a new note (output) with the report
    """
    from crystalith.shared.db import Chunk, Output, Source
    from crystalith.shared.types import SourceStatus
    from crystalith.shared.types import OutputType

    research = await _get_research_session(session, notebook_id, research_id)

    if not research.final_report:
        raise HTTPException(
            status_code=400,
            detail="Research has no final report to export",
        )

    timestamp = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")

    if payload.export_type == "source":
        # Create markdown content
        content_parts = [f"# 深度研究报告：{research.topic}\n"]
        content_parts.append(f"> 生成时间：{datetime.datetime.now().strftime('%Y-%m-%d %H:%M')}\n")
        content_parts.append(f"> 研究轮次：{research.current_iteration}/{research.max_iterations}\n\n")
        content_parts.append("---\n\n")
        content_parts.append(research.final_report)

        # Add results summary if requested
        if payload.include_results and research.aggregated_results:
            content_parts.append("\n\n---\n\n## 参考来源\n\n")
            for i, result in enumerate(research.aggregated_results[:20], 1):
                title = result.get("title", "未知标题")
                url = result.get("url", "")
                snippet = result.get("snippet", "")[:100]
                content_parts.append(f"{i}. [{title}]({url})\n")
                if snippet:
                    content_parts.append(f"   > {snippet}...\n\n")

        text_content = "".join(content_parts)
        filename = f"研究报告_{research.topic[:20]}_{timestamp}.md"

        # Create source
        source = Source(
            notebook_id=notebook_id,
            filename=filename,
            mime_type="text/markdown",
            parser_type="text",
            metadata_={
                "research_id": research.id,
                "research_topic": research.topic,
                "export_timestamp": datetime.datetime.now(datetime.UTC).isoformat(),
            },
            status=SourceStatus.PROCESSING,
        )
        session.add(source)
        await session.commit()
        await session.refresh(source)

        try:
            # Create embeddings and chunks
            log.info("starting export to source", research_id=research.id, source_id=source.id)

            # Simple chunking by paragraphs
            paragraphs = [p.strip() for p in text_content.split("\n\n") if p.strip()]
            chunk_texts = []
            current_chunk = ""
            for para in paragraphs:
                if len(current_chunk) + len(para) > 1000:
                    if current_chunk:
                        chunk_texts.append(current_chunk)
                    current_chunk = para
                else:
                    current_chunk = f"{current_chunk}\n\n{para}" if current_chunk else para
            if current_chunk:
                chunk_texts.append(current_chunk)

            if not chunk_texts:
                chunk_texts = [text_content]

            log.info("creating embeddings", chunk_count=len(chunk_texts))
            embeddings = await embedder.embed(chunk_texts)
            log.info("embeddings created", embedding_count=len(embeddings))

            db_chunks: list[Chunk] = []
            for idx, (chunk_text, embedding) in enumerate(zip(chunk_texts, embeddings)):
                chunk = Chunk(
                    source_id=source.id,
                    chunk_index=idx,
                    text=chunk_text,
                    metadata_={"source_type": "research_export"},
                )
                session.add(chunk)
                await session.flush()
                db_chunks.append(chunk)

            await vector_store.add(
                notebook_id=notebook_id,
                source_id=source.id,
                chunk_ids=[c.id for c in db_chunks],
                vectors=embeddings,
            )

            source.status = SourceStatus.READY
            await session.commit()

            log.info(
                "research exported to source",
                research_id=research.id,
                source_id=source.id,
            )

            return ExportResearchResponse(
                success=True,
                message=f"报告已导出为来源：{filename}",
                source_id=source.id,
            )

        except Exception as e:
            source.status = SourceStatus.ERROR
            await session.commit()
            log.error("failed to export research to source", error=str(e))
            raise HTTPException(status_code=500, detail=f"导出失败：{e!s}")

    elif payload.export_type == "note":
        # Create as output/note
        # Build content structure for the output
        content = {
            "title": f"研究报告：{research.topic[:30]}",
            "text": research.final_report,
            "metadata": {
                "research_id": research.id,
                "research_topic": research.topic,
                "export_timestamp": datetime.datetime.now(datetime.UTC).isoformat(),
            },
        }
        output = Output(
            notebook_id=notebook_id,
            type=OutputType.STRUCTURED,
            prompt=f"深度研究：{research.topic}",
            content=content,
        )
        session.add(output)
        await session.commit()
        await session.refresh(output)

        log.info(
            "research exported to note",
            research_id=research.id,
            output_id=output.id,
        )

        return ExportResearchResponse(
            success=True,
            message=f"报告已导出为笔记",
            note_id=output.id,
        )

    else:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid export type: {payload.export_type}. Use 'source' or 'note'.",
        )
