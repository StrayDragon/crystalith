from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from crystalith.shared.db import Chunk, Source


async def create_source(
    session: AsyncSession,
    *,
    notebook_id: int,
    filename: str,
    mime_type: str | None,
    parser_type: str,
    metadata: dict | None,
    status,
) -> Source:
    source = Source(
        notebook_id=notebook_id,
        filename=filename,
        mime_type=mime_type,
        parser_type=parser_type,
        metadata_=metadata,
        status=status,
    )
    session.add(source)
    await session.commit()
    await session.refresh(source)
    return source


async def list_sources(session: AsyncSession, *, notebook_id: int) -> list[Source]:
    result = await session.execute(
        select(Source)
        .where(Source.notebook_id == notebook_id)
        .order_by(Source.updated_at.desc())
    )
    return list(result.scalars().all())


async def get_source(session: AsyncSession, source_id: int) -> Source | None:
    return await session.get(Source, source_id)


async def delete_source(session: AsyncSession, source: Source) -> None:
    await session.delete(source)
    await session.commit()


async def count_chunks(session: AsyncSession, *, source_id: int) -> int:
    result = await session.execute(
        select(Chunk).where(Chunk.source_id == source_id)
    )
    return len(result.scalars().all())


async def create_chunks(
    session: AsyncSession,
    *,
    source_id: int,
    chunks: list[tuple[int, str, int | None, int | None, dict | None]],
) -> list[Chunk]:
    db_chunks: list[Chunk] = []
    for chunk_index, text, start_offset, end_offset, metadata in chunks:
        chunk = Chunk(
            source_id=source_id,
            chunk_index=chunk_index,
            text=text,
            start_offset=start_offset,
            end_offset=end_offset,
            metadata_=metadata,
        )
        session.add(chunk)
        db_chunks.append(chunk)
    await session.commit()
    return db_chunks
