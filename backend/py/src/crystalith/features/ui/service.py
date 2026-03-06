from __future__ import annotations

from typing import cast

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from rivu_server_sdk import UiV1CustomEvent, UiV1EventProcessor

from crystalith.shared.db import Session, UiEventReceipt
from crystalith.shared.json_types import JsonDict, JsonValue
from crystalith.shared.ui_state import apply_state_delta, ensure_session_shared_state


async def get_session(
    session: AsyncSession,
    *,
    notebook_id: int,
    session_id: int,
) -> Session | None:
    db_session = await session.get(Session, session_id)
    if db_session is None or db_session.notebook_id != notebook_id:
        return None
    return db_session


async def get_ui_event_receipt(
    session: AsyncSession,
    *,
    session_id: int,
    client_request_id: str,
) -> UiEventReceipt | None:
    result = await session.execute(
        select(UiEventReceipt).where(
            UiEventReceipt.session_id == session_id,
            UiEventReceipt.client_request_id == client_request_id,
        )
    )
    return result.scalars().first()


async def process_ui_event(
    session: AsyncSession,
    *,
    db_session: Session,
    event: UiV1CustomEvent,
) -> tuple[list[JsonDict], int]:
    client_request_id = event.value.clientRequestId
    existing = await get_ui_event_receipt(
        session,
        session_id=db_session.id,
        client_request_id=client_request_id,
    )
    if existing is not None:
        return cast(list[JsonDict], existing.state_delta), int(existing.shared_state_revision)

    shared_state = ensure_session_shared_state(db_session)
    processor = UiV1EventProcessor()
    result = processor.process(shared_state=cast(dict[str, JsonValue], shared_state), event=event)

    events = result.get("events") or []
    delta: list[JsonDict] = []
    for item in events:
        if not isinstance(item, dict):
            continue
        if item.get("type") != "STATE_DELTA":
            continue
        raw_delta = item.get("delta")
        if isinstance(raw_delta, list):
            delta = cast(list[JsonDict], raw_delta)
            break

    _shared_state, shared_state_revision = apply_state_delta(db_session, delta=delta)
    receipt = UiEventReceipt(
        session_id=db_session.id,
        client_request_id=client_request_id,
        component_id=event.value.componentId,
        event_name=event.value.eventName,
        base_revision=int(event.value.baseRevision),
        shared_state_revision=shared_state_revision,
        state_delta=delta,
    )
    session.add(receipt)
    await session.commit()
    return delta, shared_state_revision
