from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from crystalith.shared.ai.interfaces import ChatProvider
from crystalith.shared.db import Chunk, Notebook, Source
from crystalith.shared.vector_storage import VectorEntry, VectorStore

from .clustering import cluster_topics
from .contradiction import detect_contradictions
from .correlation import detect_relations
from .types import AnalysisResult
from crystalith.shared.deps import get_ai_provider, get_db_session, get_vector_store


router = APIRouter(prefix="/v1/notebooks/{notebook_id}/analysis", tags=["analysis"])


def _filter_entries(entries: list[VectorEntry], notebook_id: int) -> list[VectorEntry]:
    return [entry for entry in entries if entry.notebook_id == notebook_id]


@router.get("", response_model=AnalysisResult)
async def analyze_notebook(
    notebook_id: int,
    session: AsyncSession = Depends(get_db_session),
    vector_store: VectorStore = Depends(get_vector_store),
    chatter: ChatProvider = Depends(get_ai_provider),
) -> AnalysisResult:
    notebook = await session.get(Notebook, notebook_id)
    if notebook is None:
        raise HTTPException(status_code=404, detail="Notebook not found")

    entries = _filter_entries(list(await vector_store.entries()), notebook_id)
    if not entries:
        return AnalysisResult(topics=[], relations=[], contradictions=[])

    chunk_ids = {entry.chunk_id for entry in entries}
    rows = await session.execute(
        select(Chunk)
        .join(Source, Source.id == Chunk.source_id)
        .where(Chunk.id.in_(chunk_ids), Source.notebook_id == notebook_id)
    )
    chunks = rows.scalars().all()
    chunk_texts = {chunk.id: chunk.text for chunk in chunks}

    relations = await detect_relations(
        entries,
        notebook_id=notebook_id,
        vector_store=vector_store,
    )
    topics = cluster_topics(entries, chunk_texts)
    contradictions = await detect_contradictions(relations, chunk_texts, chatter)
    return AnalysisResult(
        topics=topics,
        relations=relations,
        contradictions=contradictions,
    )
