from __future__ import annotations

from typing import Literal, cast

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field, field_validator
from rivu_server_sdk import (
    UI_V1_EVENT_NAME,
    InvalidPayloadError,
    RevisionConflictError,
    UiV1CustomEvent,
    UnknownComponentError,
)
from sqlalchemy.ext.asyncio import AsyncSession

from crystalith.shared.deps import get_db_session
from crystalith.shared.json_types import JsonDict
from crystalith.shared.ui_state import ensure_session_shared_state

from . import service

router = APIRouter(
    prefix="/v1/notebooks/{notebook_id}/sessions/{session_id}/ui",
    tags=["ui"],
)


class SessionUiStateResponse(BaseModel):
    session_id: int
    shared_state: JsonDict
    shared_state_revision: int


class UiEventValueRequest(BaseModel):
    componentId: str = Field(..., min_length=1)
    eventName: str = Field(..., min_length=1)
    payload: JsonDict = Field(default_factory=dict)
    clientRequestId: str = Field(..., min_length=1)
    baseRevision: int = Field(..., ge=0)


class UiEventRequest(BaseModel):
    type: Literal["CUSTOM"]
    name: str
    value: UiEventValueRequest

    @field_validator("name")
    @classmethod
    def _validate_name(cls, value: str) -> str:
        if value != UI_V1_EVENT_NAME:
            raise ValueError(f"name must be {UI_V1_EVENT_NAME}")
        return value


class UiEventResponse(BaseModel):
    delta: list[JsonDict]
    shared_state_revision: int


async def _require_session(
    session: AsyncSession,
    *,
    notebook_id: int,
    session_id: int,
):
    db_session = await service.get_session(
        session,
        notebook_id=notebook_id,
        session_id=session_id,
    )
    if db_session is None:
        raise HTTPException(status_code=404, detail="Session not found")
    return db_session


@router.get("/state", response_model=SessionUiStateResponse)
async def get_ui_state(
    notebook_id: int,
    session_id: int,
    session: AsyncSession = Depends(get_db_session),
) -> SessionUiStateResponse:
    db_session = await _require_session(
        session,
        notebook_id=notebook_id,
        session_id=session_id,
    )
    shared_state = ensure_session_shared_state(db_session)
    return SessionUiStateResponse(
        session_id=db_session.id,
        shared_state=shared_state,
        shared_state_revision=int(db_session.shared_state_revision),
    )


@router.post("/event", response_model=UiEventResponse)
async def post_ui_event(
    notebook_id: int,
    session_id: int,
    payload: UiEventRequest,
    session: AsyncSession = Depends(get_db_session),
) -> UiEventResponse:
    db_session = await _require_session(
        session,
        notebook_id=notebook_id,
        session_id=session_id,
    )

    try:
        event = UiV1CustomEvent.model_validate(cast(dict[str, object], payload.model_dump(mode="python")))
        delta, shared_state_revision = await service.process_ui_event(
            session,
            db_session=db_session,
            event=event,
        )
    except RevisionConflictError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    except UnknownComponentError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except InvalidPayloadError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    return UiEventResponse(
        delta=delta,
        shared_state_revision=shared_state_revision,
    )
