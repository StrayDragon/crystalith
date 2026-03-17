from __future__ import annotations

from sqlalchemy.ext.asyncio import AsyncSession

from crystalith.shared.db import Notebook, Source
from crystalith.shared.types import SourceStatus
from crystalith.shared.utils.chunker import chunk_text

from . import repo


async def get_notebook(session: AsyncSession, notebook_id: int) -> Notebook | None:
    return await session.get(Notebook, notebook_id)


async def create_source(
    session: AsyncSession,
    *,
    notebook_id: int,
    filename: str,
    content: str | None,
    mime_type: str | None,
    parser_type: str,
    metadata: dict | None,
) -> tuple[Source, int]:
    status = SourceStatus.READY if content else SourceStatus.PROCESSING
    source = await repo.create_source(
        session,
        notebook_id=notebook_id,
        filename=filename,
        mime_type=mime_type,
        parser_type=parser_type,
        metadata=metadata,
        status=status,
    )

    chunk_count = 0
    if content:
        chunks = chunk_text(content)
        payloads: list[tuple[int, str, int | None, int | None, dict | None]] = [
            (index, payload.text, payload.start_offset, payload.end_offset, None)
            for index, payload in enumerate(chunks)
        ]
        if not payloads:
            payloads = [(0, content, 0, len(content), None)]
        await repo.create_chunks(session, source_id=source.id, chunks=payloads)
        chunk_count = len(payloads)

    return source, chunk_count


async def list_sources(session: AsyncSession, *, notebook_id: int) -> list[Source]:
    return await repo.list_sources(session, notebook_id=notebook_id)


async def get_source(session: AsyncSession, source_id: int) -> Source | None:
    return await repo.get_source(session, source_id)


async def delete_source(session: AsyncSession, source: Source) -> None:
    await repo.delete_source(session, source)


async def count_chunks(session: AsyncSession, *, source_id: int) -> int:
    return await repo.count_chunks(session, source_id=source_id)
