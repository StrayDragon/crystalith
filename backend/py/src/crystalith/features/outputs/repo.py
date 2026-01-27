from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from crystalith.shared.db import Output
from crystalith.shared.types import OutputType


async def create_output(
    session: AsyncSession,
    *,
    notebook_id: int,
    output_type: OutputType,
    prompt: str | None,
    content: dict,
) -> Output:
    output = Output(
        notebook_id=notebook_id,
        type=output_type,
        prompt=prompt,
        chunk_ids=None,
        content=content,
    )
    session.add(output)
    await session.commit()
    await session.refresh(output)
    return output


async def list_outputs(
    session: AsyncSession,
    *,
    notebook_id: int,
    offset: int,
    limit: int,
) -> list[Output]:
    result = await session.execute(
        select(Output)
        .where(Output.notebook_id == notebook_id)
        .order_by(Output.created_at.desc())
        .offset(offset)
        .limit(limit)
    )
    return list(result.scalars().all())


async def get_output(session: AsyncSession, output_id: int) -> Output | None:
    return await session.get(Output, output_id)


async def delete_output(session: AsyncSession, output: Output) -> None:
    await session.delete(output)
    await session.commit()
