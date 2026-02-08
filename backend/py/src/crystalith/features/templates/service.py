from __future__ import annotations

from typing import Any

import sqlalchemy as sa
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from crystalith.shared.db import Notebook, Session, SourceTag, Template
from crystalith.shared.types import OutputType

from . import repo
from .schemas import TemplateConfig


BUILTIN_TEMPLATES: list[dict[str, Any]] = [
    {
        "name": "论文研究",
        "description": "预配置研究会话与结构化输出偏好。",
        "config": TemplateConfig(
            session_titles=["研究问题", "文献阅读", "写作提纲"],
            output_type=OutputType.STRUCTURED,
            source_tags=["论文", "笔记", "引用"],
        ),
    },
    {
        "name": "项目文档",
        "description": "适合需求/设计/FAQ 等项目资料沉淀。",
        "config": TemplateConfig(
            session_titles=["需求讨论", "设计记录", "会议纪要"],
            output_type=OutputType.GUIDE,
            source_tags=["需求", "设计", "会议"],
        ),
    },
    {
        "name": "知识收集",
        "description": "快速收集来源并生成简报。",
        "config": TemplateConfig(
            session_titles=["收集箱", "整理区"],
            output_type=OutputType.BRIEFING,
            source_tags=["待整理", "已整理"],
        ),
    },
]


async def ensure_builtin_templates(session: AsyncSession) -> None:
    try:
        existing = (
            await session.execute(select(Template.id).limit(1))
        ).scalar_one_or_none()
    except sa.exc.SQLAlchemyError:
        # Database/table not ready yet.
        return

    if existing is not None:
        return

    for item in BUILTIN_TEMPLATES:
        template = Template(
            name=item["name"],
            description=item.get("description"),
            config_json=item["config"].model_dump(mode="json"),
            is_builtin=True,
        )
        session.add(template)

    await session.commit()


async def create_template(
    session: AsyncSession,
    *,
    name: str,
    description: str | None,
    config: TemplateConfig,
    is_builtin: bool = False,
) -> Template:
    template = Template(
        name=name,
        description=description,
        config_json=config.model_dump(mode="json"),
        is_builtin=is_builtin,
    )
    return await repo.create_template(session, template)


async def list_templates(session: AsyncSession) -> list[Template]:
    return await repo.list_templates(session)


async def get_template(session: AsyncSession, template_id: int) -> Template | None:
    return await repo.get_template(session, template_id)


async def update_template(
    session: AsyncSession,
    template: Template,
    *,
    name: str | None = None,
    description: str | None = None,
    config: TemplateConfig | None = None,
) -> Template:
    if template.is_builtin:
        raise ValueError("Built-in templates cannot be modified")

    if name is not None:
        template.name = name
    if description is not None:
        template.description = description
    if config is not None:
        template.config_json = config.model_dump(mode="json")
    return await repo.update_template(session, template)


async def delete_template(
    session: AsyncSession,
    template: Template,
) -> None:
    if template.is_builtin:
        raise ValueError("Built-in templates cannot be deleted")
    await repo.delete_template(session, template)


async def create_template_from_notebook(
    session: AsyncSession,
    *,
    notebook_id: int,
    name: str,
    description: str | None,
    output_type: OutputType | None,
) -> Template:
    notebook = await session.get(Notebook, notebook_id)
    if notebook is None:
        raise ValueError("Notebook not found")

    sessions_result = await session.execute(
        select(Session.title)
        .where(Session.notebook_id == notebook_id)
        .order_by(Session.id.asc())
    )
    session_titles = [title for (title,) in sessions_result.all() if title]

    tags_result = await session.execute(
        select(SourceTag.name)
        .where(SourceTag.notebook_id == notebook_id)
        .order_by(SourceTag.id.asc())
    )
    source_tags = [tag for (tag,) in tags_result.all() if tag]

    config = TemplateConfig(
        session_titles=session_titles,
        output_type=output_type,
        source_tags=source_tags,
    )
    return await create_template(
        session,
        name=name,
        description=description,
        config=config,
        is_builtin=False,
    )
