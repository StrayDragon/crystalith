from __future__ import annotations

import pytest

from crystalith.features.studio.slides.generator import (
    _apply_frontmatter,
    _build_frontmatter_body,
    _build_markdown_prompt,
    _build_outline_prompt,
    _normalize_frontmatter_override,
    _normalize_generation_config,
    _outline_to_markdown,
    _outline_to_text,
    _strip_frontmatter,
    _yaml_value,
    build_markdown_from_outline,
)
from crystalith.features.studio.slides.schemas import (
    SlideGenerationConfig,
    SlideOutline,
    SlideOutlineItem,
)


def test_normalize_generation_config_accepts_none_dict_and_model() -> None:
    assert _normalize_generation_config(None).quantity
    assert _normalize_generation_config({"quantity": "short"}).quantity == "short"
    config = SlideGenerationConfig(quantity="detailed")
    assert _normalize_generation_config(config) is config


def test_normalize_frontmatter_override_strips_wrapping_markers_and_whitespace() -> None:
    assert _normalize_frontmatter_override("") is None
    assert _normalize_frontmatter_override("   ") is None
    assert _normalize_frontmatter_override("---\nfoo: bar\n---\n") == "foo: bar"
    assert _normalize_frontmatter_override("foo: bar") == "foo: bar"


def test_yaml_value_renders_json_for_strings_and_structures() -> None:
    assert _yaml_value("hello") == '"hello"'
    assert _yaml_value({"a": 1}) == '{"a": 1}'
    assert _yaml_value(["a"]) == '["a"]'
    assert _yaml_value(None) == "null"


def test_build_frontmatter_body_prefers_override_and_backfills_title() -> None:
    config = SlideGenerationConfig(frontmatter="theme: default")
    body = _build_frontmatter_body("Deck", config)
    assert "title:" in body
    assert "theme:" in body

    config2 = SlideGenerationConfig(frontmatter="---\ncolorSchema: light\n---")
    body2 = _build_frontmatter_body(None, config2)
    assert "colorSchema:" in body2


def test_strip_and_apply_frontmatter_roundtrip() -> None:
    markdown = "---\ntitle: x\n---\n\n# Hello\n\n---\n## Slide\n"
    assert _strip_frontmatter(markdown).startswith("# Hello")

    applied = _apply_frontmatter("# Hi\n", "title: \"T\"")
    assert applied.startswith("---\n")
    assert "title:" in applied
    assert "# Hi" in applied


def test_outline_text_and_markdown_renderers() -> None:
    outline = SlideOutline(
        title="T",
        slides=[
            SlideOutlineItem(title="S1", bullets=["a", "b"]),
            SlideOutlineItem(title="S2", bullets=[]),
        ],
    )
    text = _outline_to_text(outline)
    assert "# T" in text
    assert "- S1" in text
    assert "  - a" in text

    md = _outline_to_markdown(outline)
    assert md.startswith("# T")
    assert "---" in md
    assert "## S1" in md
    assert "- a" in md


def test_build_prompts_include_hints_and_context() -> None:
    config = SlideGenerationConfig(
        quantity="short",
        density="sparse",
        language="en",
        audience="executive",
        tone="serious",
        structure="problem-solution",
        theme_preset="business-brief",
    )
    outline_prompt = _build_outline_prompt("Deck", "Prompt", "CTX", config)
    assert "CTX" in outline_prompt
    assert "演示标题：Deck" in outline_prompt
    assert "额外说明：Prompt" in outline_prompt
    assert "输出语言" in outline_prompt

    outline = SlideOutline(
        title="Deck",
        slides=[SlideOutlineItem(title="S", bullets=["x"])],
    )
    markdown_prompt = _build_markdown_prompt("Deck", "Prompt", outline, "CTX", config)
    assert "Slidev Markdown" in markdown_prompt
    assert "大纲" in markdown_prompt
    assert "资料来源" in markdown_prompt


def test_build_markdown_from_outline_includes_frontmatter() -> None:
    outline = SlideOutline(
        title="Deck",
        slides=[SlideOutlineItem(title="S", bullets=["x"])],
    )
    markdown = build_markdown_from_outline(outline, {"theme_preset": "minimal-clean"})
    assert markdown.startswith("---\n")
    assert "title:" in markdown
    assert "# Deck" in markdown


@pytest.mark.asyncio
async def test_generate_outline_and_markdown_fallbacks_work_with_test_model(
    client,
    app,
    db_session,
) -> None:
    from crystalith.features.studio.slides.generator import generate_slides_markdown, generate_slides_outline
    from crystalith.shared.agents.deps import StudioDeps
    from crystalith.shared.ai.factory import create_embedding_provider
    from crystalith.shared.db import Chunk, Source
    from crystalith.shared.types import SourceStatus

    notebook_resp = await client.post("/v1/notebooks", json={"name": "Slides Gen"})
    assert notebook_resp.status_code == 201
    notebook_id = notebook_resp.json()["id"]

    source = Source(notebook_id=notebook_id, filename="Doc.md", status=SourceStatus.READY)
    db_session.add(source)
    await db_session.flush()
    chunk = Chunk(source_id=source.id, chunk_index=0, text="Hello slides.")
    db_session.add(chunk)
    await db_session.commit()

    await app.state.vector_store.add(
        notebook_id=notebook_id,
        source_id=source.id,
        chunk_ids=[chunk.id],
        vectors=[[1.0, 0.0, 0.0]],
    )

    embedder = create_embedding_provider(app.state.settings, plugins=app.state.plugins)
    deps = StudioDeps(settings=app.state.settings, session=db_session, vector_store=app.state.vector_store, embedder=embedder)

    outline, chunk_ids = await generate_slides_outline(
        deps,
        notebook_id=notebook_id,
        title="Deck",
        prompt="Summarize",
        source_ids=[source.id],
        generation_config={"quantity": "short"},
    )
    assert outline.title
    assert outline.slides
    assert chunk_ids == [chunk.id]

    markdown, chunk_ids2 = await generate_slides_markdown(
        deps,
        notebook_id=notebook_id,
        title="Deck",
        prompt="Summarize",
        outline=outline,
        source_ids=[source.id],
        generation_config={"theme_preset": "minimal-clean"},
    )
    assert markdown.startswith("---\n")
    assert _strip_frontmatter(markdown)
    assert chunk_ids2 == [chunk.id]
