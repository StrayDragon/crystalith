from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from crystalith.shared.db import PromptPreset


async def list_prompt_presets(session: AsyncSession) -> list[PromptPreset]:
    result = await session.execute(select(PromptPreset).order_by(PromptPreset.id.asc()))
    return list(result.scalars().all())


async def get_prompt_preset(session: AsyncSession, preset_id: int) -> PromptPreset | None:
    return await session.get(PromptPreset, preset_id)


async def get_prompt_preset_by_trigger(session: AsyncSession, trigger: str) -> PromptPreset | None:
    result = await session.execute(select(PromptPreset).where(PromptPreset.trigger == trigger).limit(1))
    return result.scalars().first()


async def create_prompt_preset(
    session: AsyncSession,
    *,
    trigger: str,
    description: str | None,
    system_prompt: str,
    enabled: bool,
) -> PromptPreset:
    preset = PromptPreset(
        trigger=trigger,
        description=description,
        system_prompt=system_prompt,
        enabled=enabled,
    )
    session.add(preset)
    await session.commit()
    await session.refresh(preset)
    return preset


async def update_prompt_preset(session: AsyncSession, preset: PromptPreset) -> PromptPreset:
    session.add(preset)
    await session.commit()
    await session.refresh(preset)
    return preset


async def delete_prompt_preset(session: AsyncSession, preset: PromptPreset) -> None:
    await session.delete(preset)
    await session.commit()
