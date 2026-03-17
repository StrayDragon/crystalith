from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy.ext.asyncio import AsyncSession

from crystalith.shared.deps import get_db_session

from . import service
from .schemas import (
    TemplateCreate,
    TemplateFromNotebookCreate,
    TemplateRead,
    TemplateUpdate,
)

router = APIRouter(prefix="/v1", tags=["templates"])


@router.get("/templates", response_model=list[TemplateRead])
async def list_templates(
    session: AsyncSession = Depends(get_db_session),
) -> list[TemplateRead]:
    await service.ensure_builtin_templates(session)
    templates = await service.list_templates(session)
    return [TemplateRead.model_validate(item) for item in templates]


@router.post("/templates", response_model=TemplateRead, status_code=status.HTTP_201_CREATED)
async def create_template(
    payload: TemplateCreate,
    session: AsyncSession = Depends(get_db_session),
) -> TemplateRead:
    template = await service.create_template(
        session,
        name=payload.name,
        description=payload.description,
        config=payload.config_json,
    )
    return TemplateRead.model_validate(template)


@router.get("/templates/{template_id}", response_model=TemplateRead)
async def get_template(
    template_id: int,
    session: AsyncSession = Depends(get_db_session),
) -> TemplateRead:
    template = await service.get_template(session, template_id)
    if template is None:
        raise HTTPException(status_code=404, detail="Template not found")
    return TemplateRead.model_validate(template)


@router.patch("/templates/{template_id}", response_model=TemplateRead)
async def update_template(
    template_id: int,
    payload: TemplateUpdate,
    session: AsyncSession = Depends(get_db_session),
) -> TemplateRead:
    template = await service.get_template(session, template_id)
    if template is None:
        raise HTTPException(status_code=404, detail="Template not found")

    try:
        updated = await service.update_template(
            session,
            template,
            name=payload.name,
            description=payload.description,
            config=payload.config_json,
        )
    except ValueError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc

    return TemplateRead.model_validate(updated)


@router.delete("/templates/{template_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_template(
    template_id: int,
    session: AsyncSession = Depends(get_db_session),
) -> Response:
    template = await service.get_template(session, template_id)
    if template is None:
        raise HTTPException(status_code=404, detail="Template not found")
    try:
        await service.delete_template(session, template)
    except ValueError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post(
    "/notebooks/{notebook_id}/templates",
    response_model=TemplateRead,
    status_code=status.HTTP_201_CREATED,
)
async def save_notebook_as_template(
    notebook_id: int,
    payload: TemplateFromNotebookCreate,
    session: AsyncSession = Depends(get_db_session),
) -> TemplateRead:
    try:
        template = await service.create_template_from_notebook(
            session,
            notebook_id=notebook_id,
            name=payload.name,
            description=payload.description,
            output_type=payload.output_type,
        )
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    return TemplateRead.model_validate(template)
