from __future__ import annotations

from dataclasses import dataclass
from pydantic_ai import Agent
from sqlalchemy import select

from cl_logs.logging import get_logger

from crystalith.agents.deps import StudioDeps
from crystalith.agents.models import build_chat_model, build_chat_model_from_model_id
from crystalith.db import Chunk, Source
from .schemas import SlideMarkdown, SlideOutline, SlideOutlineItem
from crystalith.utils import format_context, format_context_from_chunk_ids


log = get_logger(__name__)

DEFAULT_TOP_K = 8
DEFAULT_MIN_SCORE = 0.2

SLIDES_OUTLINE_SYSTEM = (
    "You are a presentation designer. Use the provided sources to build a concise slide outline. "
    "Do not invent facts that are not supported by the sources."
)

SLIDES_MARKDOWN_SYSTEM = (
    "You are a presentation designer. Convert the outline into Slidev Markdown. "
    "Keep slides concise and easy to present."
)


@dataclass
class SlidesContext:
    context: str
    resolved_chunk_ids: list[int]


def _outline_to_text(outline: SlideOutline) -> str:
    lines: list[str] = [f"# {outline.title}"]
    for slide in outline.slides:
        lines.append(f"- {slide.title}")
        for bullet in slide.bullets:
            lines.append(f"  - {bullet}")
    return "\n".join(lines)


def _fallback_outline(title: str | None, prompt: str | None) -> SlideOutline:
    safe_title = title or prompt or "演示"
    bullets = [prompt] if prompt else ["核心观点", "关键数据", "行动建议"]
    return SlideOutline(
        title=safe_title,
        slides=[
            SlideOutlineItem(title="概览", bullets=bullets),
            SlideOutlineItem(title="关键要点", bullets=["要点 1", "要点 2", "要点 3"]),
        ],
    )


def _outline_to_markdown(outline: SlideOutline) -> str:
    lines: list[str] = ["---", f"title: {outline.title}", "---", "", f"# {outline.title}"]
    for slide in outline.slides:
        lines.append("---")
        lines.append(f"## {slide.title}")
        for bullet in slide.bullets:
            lines.append(f"- {bullet}")
        lines.append("")
    return "\n".join(lines).strip() + "\n"


def _build_outline_prompt(title: str | None, prompt: str | None, context: str) -> str:
    safe_title = title or "演示"
    safe_prompt = prompt or "请根据资料生成演示大纲。"
    return (
        "请生成演示大纲，输出 6-12 张幻灯片的标题与要点。\n"
        "要求：每页 3-5 个要点，简洁易讲述。\n\n"
        f"演示标题：{safe_title}\n"
        f"额外说明：{safe_prompt}\n\n"
        f"资料来源：\n{context}"
    )


def _build_markdown_prompt(
    title: str | None,
    prompt: str | None,
    outline: SlideOutline,
    context: str,
) -> str:
    safe_title = title or outline.title
    safe_prompt = prompt or "请根据大纲生成演示。"
    outline_text = _outline_to_text(outline)
    return (
        "请生成 Slidev Markdown 幻灯片内容。\n"
        "要求：\n"
        "- 使用 Slidev 语法，使用 --- 分隔幻灯片\n"
        "- 第一页是标题页，使用 # 标题\n"
        "- 每页内容简洁，使用项目符号\n\n"
        f"演示标题：{safe_title}\n"
        f"额外说明：{safe_prompt}\n\n"
        f"大纲：\n{outline_text}\n\n"
        f"资料来源：\n{context}"
    )


async def _resolve_context(
    deps: StudioDeps,
    notebook_id: int,
    prompt: str | None,
    chunk_ids: list[int] | None,
    *,
    top_k: int = DEFAULT_TOP_K,
    min_score: float = DEFAULT_MIN_SCORE,
) -> SlidesContext:
    explicit_chunk_ids = [int(v) for v in (chunk_ids or []) if int(v) > 0]
    if explicit_chunk_ids:
        rows = await deps.session.execute(
            select(Chunk, Source)
            .join(Source, Source.id == Chunk.source_id)
            .where(Chunk.id.in_(explicit_chunk_ids), Source.notebook_id == notebook_id)
        )
        chunk_map: dict[int, tuple[Chunk, Source]] = {
            chunk.id: (chunk, source) for chunk, source in rows.all()
        }
        missing = [cid for cid in explicit_chunk_ids if cid not in chunk_map]
        if missing:
            raise ValueError("Unknown chunk_id in chunk_ids")
        return SlidesContext(
            context=format_context_from_chunk_ids(explicit_chunk_ids, chunk_map),
            resolved_chunk_ids=explicit_chunk_ids,
        )

    seed = (prompt or "").strip() or "Summarize the notebook sources."
    embeddings = await deps.embedder.embed([seed])
    if not embeddings:
        return SlidesContext(context="", resolved_chunk_ids=[])

    query_vector = embeddings[0]
    results = await deps.vector_store.search(
        notebook_id=notebook_id,
        query_vector=query_vector,
        top_k=top_k,
        min_score=min_score,
    )
    if not results:
        return SlidesContext(context="", resolved_chunk_ids=[])

    chunk_ids = [result.entry.chunk_id for result in results]
    rows = await deps.session.execute(
        select(Chunk, Source)
        .join(Source, Source.id == Chunk.source_id)
        .where(Chunk.id.in_(chunk_ids))
    )
    chunk_map = {chunk.id: (chunk, source) for chunk, source in rows.all()}
    return SlidesContext(
        context=format_context(results, chunk_map),
        resolved_chunk_ids=chunk_ids,
    )


async def generate_slides_outline(
    deps: StudioDeps,
    *,
    notebook_id: int,
    title: str | None,
    prompt: str | None,
    chunk_ids: list[int] | None,
    model_id: str | None = None,
) -> tuple[SlideOutline, list[int]]:
    context = await _resolve_context(
        deps,
        notebook_id,
        prompt,
        chunk_ids,
    )

    if model_id:
        model = build_chat_model_from_model_id(deps.settings, model_id)
    else:
        model = deps.model or build_chat_model(deps.settings)

    agent = Agent(
        model,
        output_type=SlideOutline,
        deps_type=StudioDeps,
        system_prompt=SLIDES_OUTLINE_SYSTEM,
        retries=2,
    )

    user_prompt = _build_outline_prompt(title, prompt, context.context)

    try:
        result = await agent.run(user_prompt, deps=deps)
        outline = result.output
        log.info("slides outline generated", slides=len(outline.slides))
    except Exception as error:  # noqa: BLE001
        log.warning("slides outline generation failed", error=type(error).__name__)
        outline = _fallback_outline(title, prompt)

    return outline, context.resolved_chunk_ids


async def generate_slides_markdown(
    deps: StudioDeps,
    *,
    notebook_id: int,
    title: str | None,
    prompt: str | None,
    outline: SlideOutline,
    chunk_ids: list[int] | None,
    model_id: str | None = None,
) -> tuple[str, list[int]]:
    context = await _resolve_context(
        deps,
        notebook_id,
        prompt,
        chunk_ids,
    )

    if model_id:
        model = build_chat_model_from_model_id(deps.settings, model_id)
    else:
        model = deps.model or build_chat_model(deps.settings)

    agent = Agent(
        model,
        output_type=SlideMarkdown,
        deps_type=StudioDeps,
        system_prompt=SLIDES_MARKDOWN_SYSTEM,
        retries=2,
    )

    user_prompt = _build_markdown_prompt(title, prompt, outline, context.context)

    try:
        result = await agent.run(user_prompt, deps=deps)
        markdown = result.output.markdown
        log.info("slides markdown generated", length=len(markdown))
    except Exception as error:  # noqa: BLE001
        log.warning("slides markdown generation failed", error=type(error).__name__)
        markdown = _outline_to_markdown(outline)

    return markdown, context.resolved_chunk_ids


def build_markdown_from_outline(outline: SlideOutline) -> str:
    return _outline_to_markdown(outline)
