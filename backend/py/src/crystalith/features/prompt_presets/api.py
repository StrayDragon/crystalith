from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy.ext.asyncio import AsyncSession

from ..qa.presets import get_preset as get_builtin_preset, list_preset_ids
from crystalith.shared.deps import get_db_session

from . import repo, service
from .schemas import PromptPresetCreate, PromptPresetRead, PromptPresetUpdate


router = APIRouter(prefix="/v1", tags=["prompt-presets"])


def _builtin_to_read(trigger: str) -> PromptPresetRead | None:
    preset = get_builtin_preset(trigger)
    if preset is None:
        return None
    return PromptPresetRead(
        preset_id=None,
        trigger=preset.id,
        description=preset.description,
        system_prompt=preset.system_prompt,
        enabled=True,
        source="builtin",
        created_at=None,
        updated_at=None,
    )


def _custom_to_read(preset) -> PromptPresetRead:
    return PromptPresetRead(
        preset_id=preset.id,
        trigger=preset.trigger,
        description=preset.description,
        system_prompt=preset.system_prompt,
        enabled=bool(preset.enabled),
        source="custom",
        created_at=preset.created_at,
        updated_at=preset.updated_at,
    )


@router.get("/prompt-presets", response_model=list[PromptPresetRead])
async def list_prompt_presets(
    session: AsyncSession = Depends(get_db_session),
) -> list[PromptPresetRead]:
    custom = await repo.list_prompt_presets(session)
    items: list[PromptPresetRead] = []
    for preset_id in list_preset_ids():
        builtin = _builtin_to_read(preset_id)
        if builtin is None:
            continue
        items.append(builtin)
    items.extend(_custom_to_read(row) for row in custom)
    return items


@router.post(
    "/prompt-presets",
    response_model=PromptPresetRead,
    status_code=status.HTTP_201_CREATED,
)
async def create_prompt_preset(
    payload: PromptPresetCreate,
    session: AsyncSession = Depends(get_db_session),
) -> PromptPresetRead:
    try:
        preset = await service.create_custom_preset(
            session,
            trigger=payload.trigger,
            description=payload.description,
            system_prompt=payload.system_prompt,
            enabled=payload.enabled,
        )
    except ValueError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    return _custom_to_read(preset)


@router.patch("/prompt-presets/{preset_id}", response_model=PromptPresetRead)
async def update_prompt_preset(
    preset_id: int,
    payload: PromptPresetUpdate,
    session: AsyncSession = Depends(get_db_session),
) -> PromptPresetRead:
    try:
        preset = await service.update_custom_preset(
            session,
            preset_id,
            trigger=payload.trigger,
            description=payload.description,
            system_prompt=payload.system_prompt,
            enabled=payload.enabled,
        )
    except ValueError as exc:
        message = str(exc)
        if message == "preset not found":
            raise HTTPException(status_code=404, detail="Prompt preset not found") from exc
        raise HTTPException(status_code=409, detail=message) from exc
    return _custom_to_read(preset)


@router.delete("/prompt-presets/{preset_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_prompt_preset(
    preset_id: int,
    session: AsyncSession = Depends(get_db_session),
) -> Response:
    try:
        await service.delete_custom_preset(session, preset_id)
    except ValueError as exc:
        message = str(exc)
        if message == "preset not found":
            raise HTTPException(status_code=404, detail="Prompt preset not found") from exc
        raise HTTPException(status_code=409, detail=message) from exc
    return Response(status_code=status.HTTP_204_NO_CONTENT)
