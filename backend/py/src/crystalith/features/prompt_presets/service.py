from __future__ import annotations

from dataclasses import dataclass

from sqlalchemy.ext.asyncio import AsyncSession

from crystalith.shared.db import PromptPreset

from ..qa.presets import QAPreset, list_preset_ids
from ..qa.presets import get_preset as get_builtin_preset
from . import repo


@dataclass(frozen=True, slots=True)
class ResolvedPromptPreset:
    trigger: str
    description: str | None
    system_prompt: str
    enabled: bool
    source: str


def _to_builtin_read(preset: QAPreset) -> ResolvedPromptPreset:
    return ResolvedPromptPreset(
        trigger=preset.id,
        description=preset.description,
        system_prompt=preset.system_prompt,
        enabled=True,
        source="builtin",
    )


def _to_custom_read(preset: PromptPreset) -> ResolvedPromptPreset:
    return ResolvedPromptPreset(
        trigger=preset.trigger,
        description=preset.description,
        system_prompt=preset.system_prompt,
        enabled=bool(preset.enabled),
        source="custom",
    )


async def list_all_presets(session: AsyncSession) -> tuple[list[ResolvedPromptPreset], list[PromptPreset]]:
    """Return (resolved presets, custom rows)."""
    custom_rows = await repo.list_prompt_presets(session)
    builtins = []
    for preset_id in list_preset_ids():
        preset = get_builtin_preset(preset_id)
        if preset is None:
            continue
        builtins.append(_to_builtin_read(preset))
    customs = [_to_custom_read(row) for row in custom_rows]
    return builtins + customs, custom_rows


async def resolve_preset(session: AsyncSession, trigger: str) -> ResolvedPromptPreset | None:
    builtin = get_builtin_preset(trigger)
    if builtin is not None:
        return _to_builtin_read(builtin)
    custom = await repo.get_prompt_preset_by_trigger(session, trigger)
    if custom is None:
        return None
    return _to_custom_read(custom)


async def create_custom_preset(
    session: AsyncSession,
    *,
    trigger: str,
    description: str | None,
    system_prompt: str,
    enabled: bool,
) -> PromptPreset:
    if get_builtin_preset(trigger) is not None:
        raise ValueError("trigger conflicts with a built-in preset")
    existing = await repo.get_prompt_preset_by_trigger(session, trigger)
    if existing is not None:
        raise ValueError("trigger already exists")
    return await repo.create_prompt_preset(
        session,
        trigger=trigger,
        description=description,
        system_prompt=system_prompt,
        enabled=enabled,
    )


async def update_custom_preset(
    session: AsyncSession,
    preset_id: int,
    *,
    trigger: str | None,
    description: str | None,
    system_prompt: str | None,
    enabled: bool | None,
) -> PromptPreset:
    preset = await repo.get_prompt_preset(session, preset_id)
    if preset is None:
        raise ValueError("preset not found")

    if trigger is not None and trigger != preset.trigger:
        if get_builtin_preset(trigger) is not None:
            raise ValueError("trigger conflicts with a built-in preset")
        existing = await repo.get_prompt_preset_by_trigger(session, trigger)
        if existing is not None and existing.id != preset.id:
            raise ValueError("trigger already exists")
        preset.trigger = trigger

    if description is not None:
        preset.description = description
    if system_prompt is not None:
        preset.system_prompt = system_prompt
    if enabled is not None:
        preset.enabled = enabled

    return await repo.update_prompt_preset(session, preset)


async def delete_custom_preset(session: AsyncSession, preset_id: int) -> None:
    preset = await repo.get_prompt_preset(session, preset_id)
    if preset is None:
        raise ValueError("preset not found")
    await repo.delete_prompt_preset(session, preset)
