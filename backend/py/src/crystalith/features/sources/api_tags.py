from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from crystalith.shared.cache import CacheProvider
from crystalith.shared.db import Notebook, SourceTag, SourceTagMap

from crystalith.shared.deps import (
    get_cache_provider,
    get_db_session,
)

from .api_common import (
    _fetch_sources_or_404,
    _invalidate_notebook_source_caches,
)
from .api_schemas import (
    SourceTagCreateRequest,
    SourceTagRead,
    SourceTagSourceBindingRequest,
    SourceTagSourceBindingResponse,
    SourceTagUpdateRequest,
)

router = APIRouter()


@router.get("/tags", response_model=list[SourceTagRead])
async def list_source_tags(
    notebook_id: int,
    session: AsyncSession = Depends(get_db_session),
) -> list[SourceTagRead]:
    notebook = await session.get(Notebook, notebook_id)
    if notebook is None:
        raise HTTPException(status_code=404, detail="Notebook not found")

    result = await session.execute(
        select(SourceTag)
        .where(SourceTag.notebook_id == notebook_id)
        .order_by(func.lower(SourceTag.name).asc(), SourceTag.id.asc())
    )
    return [SourceTagRead.model_validate(tag) for tag in result.scalars().all()]


@router.post("/tags", response_model=SourceTagRead, status_code=status.HTTP_201_CREATED)
async def create_source_tag(
    notebook_id: int,
    payload: SourceTagCreateRequest,
    session: AsyncSession = Depends(get_db_session),
) -> SourceTagRead:
    notebook = await session.get(Notebook, notebook_id)
    if notebook is None:
        raise HTTPException(status_code=404, detail="Notebook not found")

    result = await session.execute(
        select(SourceTag.id).where(
            SourceTag.notebook_id == notebook_id,
            func.lower(SourceTag.name) == payload.name.lower(),
        )
    )
    if result.scalar_one_or_none() is not None:
        raise HTTPException(status_code=409, detail="Tag already exists")

    tag = SourceTag(notebook_id=notebook_id, name=payload.name)
    session.add(tag)
    await session.commit()
    await session.refresh(tag)
    return SourceTagRead.model_validate(tag)


@router.patch("/tags/{tag_id}", response_model=SourceTagRead)
async def update_source_tag(
    notebook_id: int,
    tag_id: int,
    payload: SourceTagUpdateRequest,
    session: AsyncSession = Depends(get_db_session),
    cache: CacheProvider = Depends(get_cache_provider),
) -> SourceTagRead:
    tag = await session.get(SourceTag, tag_id)
    if tag is None or tag.notebook_id != notebook_id:
        raise HTTPException(status_code=404, detail="Tag not found")

    result = await session.execute(
        select(SourceTag.id).where(
            SourceTag.notebook_id == notebook_id,
            SourceTag.id != tag_id,
            func.lower(SourceTag.name) == payload.name.lower(),
        )
    )
    if result.scalar_one_or_none() is not None:
        raise HTTPException(status_code=409, detail="Tag already exists")

    tag.name = payload.name
    session.add(tag)
    await session.commit()
    await session.refresh(tag)
    await _invalidate_notebook_source_caches(cache, notebook_id=notebook_id)
    return SourceTagRead.model_validate(tag)


@router.delete("/tags/{tag_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_source_tag(
    notebook_id: int,
    tag_id: int,
    session: AsyncSession = Depends(get_db_session),
    cache: CacheProvider = Depends(get_cache_provider),
) -> None:
    tag = await session.get(SourceTag, tag_id)
    if tag is None or tag.notebook_id != notebook_id:
        raise HTTPException(status_code=404, detail="Tag not found")

    await session.delete(tag)
    await session.commit()
    await _invalidate_notebook_source_caches(cache, notebook_id=notebook_id)


@router.post("/tags/{tag_id}/sources", response_model=SourceTagSourceBindingResponse)
async def assign_tag_to_sources(
    notebook_id: int,
    tag_id: int,
    payload: SourceTagSourceBindingRequest,
    session: AsyncSession = Depends(get_db_session),
    cache: CacheProvider = Depends(get_cache_provider),
) -> SourceTagSourceBindingResponse:
    tag = await session.get(SourceTag, tag_id)
    if tag is None or tag.notebook_id != notebook_id:
        raise HTTPException(status_code=404, detail="Tag not found")

    source_ids = list(dict.fromkeys(payload.source_ids))
    await _fetch_sources_or_404(session, notebook_id=notebook_id, source_ids=source_ids)

    existing_result = await session.execute(
        select(SourceTagMap.source_id)
        .where(SourceTagMap.tag_id == tag_id, SourceTagMap.source_id.in_(source_ids))
    )
    existing_ids = {source_id for source_id, in existing_result.all()}

    for source_id in source_ids:
        if source_id in existing_ids:
            continue
        session.add(SourceTagMap(source_id=source_id, tag_id=tag_id))

    await session.commit()
    await _invalidate_notebook_source_caches(cache, notebook_id=notebook_id)

    return SourceTagSourceBindingResponse(
        tag_id=tag_id,
        source_ids=source_ids,
        count=len(source_ids),
    )


@router.delete("/tags/{tag_id}/sources", response_model=SourceTagSourceBindingResponse)
async def remove_tag_from_sources(
    notebook_id: int,
    tag_id: int,
    payload: SourceTagSourceBindingRequest,
    session: AsyncSession = Depends(get_db_session),
    cache: CacheProvider = Depends(get_cache_provider),
) -> SourceTagSourceBindingResponse:
    tag = await session.get(SourceTag, tag_id)
    if tag is None or tag.notebook_id != notebook_id:
        raise HTTPException(status_code=404, detail="Tag not found")

    source_ids = list(dict.fromkeys(payload.source_ids))
    await _fetch_sources_or_404(session, notebook_id=notebook_id, source_ids=source_ids)

    mappings_result = await session.execute(
        select(SourceTagMap)
        .where(SourceTagMap.tag_id == tag_id, SourceTagMap.source_id.in_(source_ids))
    )
    mappings = mappings_result.scalars().all()
    for mapping in mappings:
        await session.delete(mapping)
    await session.commit()
    await _invalidate_notebook_source_caches(cache, notebook_id=notebook_id)

    return SourceTagSourceBindingResponse(
        tag_id=tag_id,
        source_ids=source_ids,
        count=len(mappings),
    )
