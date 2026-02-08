from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from crystalith.shared.db import Template


async def create_template(
    session: AsyncSession,
    template: Template,
) -> Template:
    session.add(template)
    await session.commit()
    await session.refresh(template)
    return template


async def list_templates(session: AsyncSession) -> list[Template]:
    result = await session.execute(
        select(Template).order_by(Template.is_builtin.desc(), Template.id.asc())
    )
    return list(result.scalars().all())


async def get_template(session: AsyncSession, template_id: int) -> Template | None:
    return await session.get(Template, template_id)


async def update_template(session: AsyncSession, template: Template) -> Template:
    session.add(template)
    await session.commit()
    await session.refresh(template)
    return template


async def delete_template(session: AsyncSession, template: Template) -> None:
    await session.delete(template)
    await session.commit()
