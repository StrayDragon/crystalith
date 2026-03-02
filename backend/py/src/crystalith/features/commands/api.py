from __future__ import annotations

from typing import Literal

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from ..prompt_presets import repo as prompt_preset_repo
from ..qa.presets import get_preset as get_builtin_preset, list_preset_ids
from crystalith.shared.deps import get_db_session
from crystalith.shared.json_types import JsonDict


router = APIRouter(prefix="/v1", tags=["commands"])


CommandKind = Literal["prompt_preset"]
CommandSource = Literal["builtin", "custom"]


class CommandRead(BaseModel):
    id: str = Field(..., description="Stable command id (e.g. preset trigger).")
    kind: CommandKind
    trigger: str = Field(..., description="Trigger string that can be typed (e.g. /prompt:stats).")
    description: str = ""
    enabled: bool = True
    source: CommandSource
    meta: JsonDict | None = None


def _prompt_trigger(trigger: str) -> str:
    return f"/prompt:{trigger}"


@router.get("/commands", response_model=list[CommandRead])
async def list_commands(
    session: AsyncSession = Depends(get_db_session),
) -> list[CommandRead]:
    commands: list[CommandRead] = []

    for preset_id in list_preset_ids():
        preset = get_builtin_preset(preset_id)
        if preset is None:
            continue
        commands.append(
            CommandRead(
                id=preset.id,
                kind="prompt_preset",
                trigger=_prompt_trigger(preset.id),
                description=preset.description or "",
                enabled=True,
                source="builtin",
            )
        )

    custom = await prompt_preset_repo.list_prompt_presets(session)
    for preset in custom:
        commands.append(
            CommandRead(
                id=preset.trigger,
                kind="prompt_preset",
                trigger=_prompt_trigger(preset.trigger),
                description=preset.description or "",
                enabled=bool(preset.enabled),
                source="custom",
            )
        )

    commands.sort(key=lambda item: item.trigger)
    return commands
