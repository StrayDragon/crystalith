from __future__ import annotations

import json
from dataclasses import dataclass
from pydantic_ai import Agent
from sqlalchemy import select

from cl_logs.logging import get_logger

from crystalith.agents.deps import StudioDeps
from crystalith.agents.models import build_chat_model, build_chat_model_from_model_id
from crystalith.db import Chunk, Source
from .schemas import SlideGenerationConfig, SlideMarkdown, SlideOutline, SlideOutlineItem
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

DEFAULT_CONFIG = SlideGenerationConfig(
    quantity="standard",
    audience="general",
    structure="standard",
    tone="professional",
    language="zh",
    density="standard",
    theme_preset="minimal-clean",
)

QUANTITY_RANGES: dict[str, tuple[int, int]] = {
    "short": (6, 8),
    "standard": (8, 12),
    "detailed": (12, 18),
}

DENSITY_BULLETS: dict[str, tuple[int, int]] = {
    "sparse": (2, 3),
    "standard": (3, 5),
    "dense": (5, 7),
}

STRUCTURE_TEMPLATES: dict[str, str] = {
    "standard": "封面 / 议程 / 背景 / 关键发现 / 结论 / 下一步",
    "problem-solution": "背景 / 问题 / 影响 / 方案 / 实施计划 / 收益 / 下一步",
    "story": "起点 / 冲突 / 转折 / 洞察 / 行动 / 结尾",
    "project-review": "目标 / 过程 / 结果 / 复盘 / 行动计划",
    "training": "目标 / 核心概念 / 示例 / 练习 / 总结",
}

AUDIENCE_HINTS: dict[str, str] = {
    "general": "通俗易懂，避免过多术语",
    "executive": "强调结论与决策要点，简洁直达",
    "technical": "保留必要技术细节与定义",
    "external": "强调价值与故事性，避免内部术语",
}

TONE_HINTS: dict[str, str] = {
    "professional": "正式、专业",
    "friendly": "亲和、易读",
    "inspiring": "鼓舞、强调愿景",
    "serious": "严谨、客观",
}

LANGUAGE_HINTS: dict[str, str] = {
    "zh": "中文",
    "en": "英文",
}

THEME_PRESET_TEMPLATES: dict[str, dict[str, object]] = {
    "minimal-clean": {
        "theme": "default",
        "colorSchema": "light",
        "fonts": {"sans": "Manrope", "serif": "Noto Serif SC", "mono": "Fira Code"},
        "transition": "fade",
        "background": "#F8FAFC",
        "class": "text-left",
    },
    "business-brief": {
        "theme": "default",
        "colorSchema": "light",
        "fonts": {"sans": "IBM Plex Sans", "serif": "Noto Serif SC", "mono": "JetBrains Mono"},
        "transition": "slide-left",
        "background": "linear-gradient(180deg, #F8FAFC 0%, #EEF2FF 100%)",
        "class": "text-left",
    },
    "product-launch": {
        "theme": "default",
        "colorSchema": "light",
        "fonts": {"sans": "Space Grotesk", "serif": "Noto Serif SC", "mono": "Fira Code"},
        "transition": "fade-out",
        "background": "radial-gradient(circle at 20% 20%, #FDE68A 0%, #FFFFFF 45%, #EEF2FF 100%)",
        "class": "text-center",
    },
    "research-paper": {
        "theme": "default",
        "colorSchema": "light",
        "fonts": {"sans": "Source Sans 3", "serif": "Source Serif 4", "mono": "Source Code Pro"},
        "transition": "slide-up",
        "background": "#FFFBF5",
        "class": "text-left",
    },
    "data-insight": {
        "theme": "default",
        "colorSchema": "light",
        "fonts": {"sans": "Inter", "serif": "Noto Serif SC", "mono": "JetBrains Mono"},
        "transition": "slide-right",
        "background": "repeating-linear-gradient(0deg, #F8FAFC 0px, #F8FAFC 24px, #E5E7EB 25px)",
        "class": "text-left",
    },
    "creative-visual": {
        "theme": "default",
        "colorSchema": "dark",
        "fonts": {"sans": "Bebas Neue", "serif": "Noto Serif SC", "mono": "Fira Code"},
        "transition": "zoom",
        "background": "linear-gradient(135deg, #0F172A 0%, #111827 50%, #1F2937 100%)",
        "class": "text-white text-left",
    },
}


@dataclass
class SlidesContext:
    context: str
    resolved_chunk_ids: list[int]


def _normalize_generation_config(
    config: SlideGenerationConfig | dict[str, object] | None,
) -> SlideGenerationConfig:
    if isinstance(config, SlideGenerationConfig):
        return config
    if isinstance(config, dict):
        return SlideGenerationConfig.model_validate(config)
    return DEFAULT_CONFIG


def _resolve_quantity_range(config: SlideGenerationConfig) -> tuple[int, int]:
    quantity = config.quantity or DEFAULT_CONFIG.quantity or "standard"
    return QUANTITY_RANGES.get(quantity, QUANTITY_RANGES["standard"])


def _resolve_bullet_range(config: SlideGenerationConfig) -> tuple[int, int]:
    density = config.density or DEFAULT_CONFIG.density or "standard"
    return DENSITY_BULLETS.get(density, DENSITY_BULLETS["standard"])


def _resolve_structure_hint(config: SlideGenerationConfig) -> str | None:
    structure = config.structure or DEFAULT_CONFIG.structure or "standard"
    return STRUCTURE_TEMPLATES.get(structure)


def _resolve_audience_hint(config: SlideGenerationConfig) -> str | None:
    audience = config.audience or DEFAULT_CONFIG.audience or "general"
    return AUDIENCE_HINTS.get(audience)


def _resolve_tone_hint(config: SlideGenerationConfig) -> str | None:
    tone = config.tone or DEFAULT_CONFIG.tone or "professional"
    return TONE_HINTS.get(tone)


def _resolve_language_hint(config: SlideGenerationConfig) -> str | None:
    language = config.language or DEFAULT_CONFIG.language or "zh"
    return LANGUAGE_HINTS.get(language)


def _resolve_theme_preset(config: SlideGenerationConfig) -> str:
    preset = config.theme_preset or DEFAULT_CONFIG.theme_preset or "minimal-clean"
    return preset if preset in THEME_PRESET_TEMPLATES else "minimal-clean"


def _normalize_frontmatter_override(value: str | None) -> str | None:
    if not value:
        return None
    cleaned = value.strip()
    if not cleaned:
        return None
    if cleaned.startswith("---"):
        lines = [line for line in cleaned.splitlines()]
        if lines and lines[0].strip() == "---":
            lines = lines[1:]
        if lines and lines[-1].strip() == "---":
            lines = lines[:-1]
        cleaned = "\n".join(lines).strip()
    return cleaned or None


def _yaml_value(value: object) -> str:
    if isinstance(value, (dict, list)):
        return json.dumps(value, ensure_ascii=False)
    if isinstance(value, str):
        return json.dumps(value, ensure_ascii=False)
    if value is None:
        return "null"
    return str(value)


def _build_frontmatter_body(title: str | None, config: SlideGenerationConfig) -> str:
    override = _normalize_frontmatter_override(config.frontmatter)
    if override:
        if title and "title:" not in override:
            return f"title: {_yaml_value(title)}\n{override}".strip()
        return override.strip()

    preset = _resolve_theme_preset(config)
    template = THEME_PRESET_TEMPLATES.get(preset, THEME_PRESET_TEMPLATES["minimal-clean"])
    lines: list[str] = []
    if title:
        lines.append(f"title: {_yaml_value(title)}")
    for key, value in template.items():
        if key == "fonts" and isinstance(value, dict):
            lines.append("fonts:")
            for font_key, font_value in value.items():
                lines.append(f"  {font_key}: {_yaml_value(font_value)}")
        else:
            lines.append(f"{key}: {_yaml_value(value)}")
    return "\n".join(lines).strip()


def _strip_frontmatter(markdown: str) -> str:
    stripped = markdown.lstrip()
    if not stripped.startswith("---"):
        return markdown.strip()
    lines = stripped.splitlines()
    if not lines or lines[0].strip() != "---":
        return markdown.strip()
    for idx in range(1, len(lines)):
        if lines[idx].strip() == "---":
            body = "\n".join(lines[idx + 1 :]).lstrip("\n")
            return body.strip()
    return markdown.strip()


def _apply_frontmatter(markdown: str, frontmatter_body: str | None) -> str:
    if not frontmatter_body:
        return markdown.strip()
    body = _strip_frontmatter(markdown)
    if body:
        return f"---\n{frontmatter_body.strip()}\n---\n\n{body.strip()}\n"
    return f"---\n{frontmatter_body.strip()}\n---\n"

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
    lines: list[str] = [f"# {outline.title}"]
    for slide in outline.slides:
        lines.append("---")
        lines.append(f"## {slide.title}")
        for bullet in slide.bullets:
            lines.append(f"- {bullet}")
        lines.append("")
    return "\n".join(lines).strip() + "\n"


def _build_outline_prompt(
    title: str | None,
    prompt: str | None,
    context: str,
    config: SlideGenerationConfig | None = None,
) -> str:
    safe_title = title or "演示"
    safe_prompt = prompt or "请根据资料生成演示大纲。"
    normalized = _normalize_generation_config(config)
    slide_min, slide_max = _resolve_quantity_range(normalized)
    bullet_min, bullet_max = _resolve_bullet_range(normalized)
    structure_hint = _resolve_structure_hint(normalized)
    audience_hint = _resolve_audience_hint(normalized)
    tone_hint = _resolve_tone_hint(normalized)
    language_hint = _resolve_language_hint(normalized)
    theme_hint = _resolve_theme_preset(normalized)

    requirement_lines = [
        f"请生成演示大纲，输出 {slide_min}-{slide_max} 张幻灯片的标题与要点。",
        f"要求：每页 {bullet_min}-{bullet_max} 个要点，简洁易讲述。",
    ]
    if language_hint:
        requirement_lines.append(f"输出语言：{language_hint}")
    if audience_hint:
        requirement_lines.append(f"受众定位：{audience_hint}")
    if tone_hint:
        requirement_lines.append(f"语气风格：{tone_hint}")
    if structure_hint:
        requirement_lines.append(f"结构模板：{structure_hint}")
    if theme_hint:
        requirement_lines.append(f"主题预设：{theme_hint}")

    requirements = "\n".join(requirement_lines)
    return (
        f"{requirements}\n\n"
        f"演示标题：{safe_title}\n"
        f"额外说明：{safe_prompt}\n\n"
        f"资料来源：\n{context}"
    )


def _build_markdown_prompt(
    title: str | None,
    prompt: str | None,
    outline: SlideOutline,
    context: str,
    config: SlideGenerationConfig | None = None,
) -> str:
    safe_title = title or outline.title
    safe_prompt = prompt or "请根据大纲生成演示。"
    outline_text = _outline_to_text(outline)
    normalized = _normalize_generation_config(config)
    bullet_min, bullet_max = _resolve_bullet_range(normalized)
    structure_hint = _resolve_structure_hint(normalized)
    audience_hint = _resolve_audience_hint(normalized)
    tone_hint = _resolve_tone_hint(normalized)
    language_hint = _resolve_language_hint(normalized)
    theme_hint = _resolve_theme_preset(normalized)
    frontmatter_hint = _build_frontmatter_body(safe_title, normalized)

    requirement_lines = [
        "请生成 Slidev Markdown 幻灯片内容。",
        "要求：",
        "- 使用 Slidev 语法，使用 --- 分隔幻灯片",
        "- 第一页是标题页，使用 # 标题",
        f"- 每页内容简洁，使用项目符号（每页 {bullet_min}-{bullet_max} 条）",
    ]
    if language_hint:
        requirement_lines.append(f"- 输出语言：{language_hint}")
    if audience_hint:
        requirement_lines.append(f"- 受众定位：{audience_hint}")
    if tone_hint:
        requirement_lines.append(f"- 语气风格：{tone_hint}")
    if structure_hint:
        requirement_lines.append(f"- 结构模板：{structure_hint}")
    if theme_hint:
        requirement_lines.append(f"- 主题预设：{theme_hint}")
    if frontmatter_hint:
        requirement_lines.append("- Frontmatter 需包含以下字段：")
        requirement_lines.append(frontmatter_hint)

    requirements = "\n".join(requirement_lines)
    return (
        f"{requirements}\n\n"
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
    generation_config: SlideGenerationConfig | dict[str, object] | None = None,
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

    user_prompt = _build_outline_prompt(title, prompt, context.context, generation_config)

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
    generation_config: SlideGenerationConfig | dict[str, object] | None = None,
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

    user_prompt = _build_markdown_prompt(title, prompt, outline, context.context, generation_config)

    try:
        result = await agent.run(user_prompt, deps=deps)
        markdown = result.output.markdown
        log.info("slides markdown generated", length=len(markdown))
    except Exception as error:  # noqa: BLE001
        log.warning("slides markdown generation failed", error=type(error).__name__)
        markdown = _outline_to_markdown(outline)

    normalized = _normalize_generation_config(generation_config)
    frontmatter_body = _build_frontmatter_body(title or outline.title, normalized)
    markdown = _apply_frontmatter(markdown, frontmatter_body)
    return markdown, context.resolved_chunk_ids


def build_markdown_from_outline(
    outline: SlideOutline,
    generation_config: SlideGenerationConfig | dict[str, object] | None = None,
) -> str:
    markdown = _outline_to_markdown(outline)
    normalized = _normalize_generation_config(generation_config)
    frontmatter_body = _build_frontmatter_body(outline.title, normalized)
    return _apply_frontmatter(markdown, frontmatter_body)
