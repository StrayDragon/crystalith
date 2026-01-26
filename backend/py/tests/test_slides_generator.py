from __future__ import annotations

import pytest
from pydantic_ai.models.test import TestModel

from crystalith.agents.deps import StudioDeps
from crystalith.studio.slides import generator
from crystalith.studio.slides.generator import _build_outline_prompt, build_markdown_from_outline
from crystalith.studio.slides.schemas import SlideGenerationConfig, SlideOutline, SlideOutlineItem


def test_outline_prompt_includes_generation_config() -> None:
    config = SlideGenerationConfig(
        quantity="short",
        density="dense",
        structure="story",
        tone="inspiring",
        audience="executive",
        language="en",
        theme_preset="creative-visual",
    )
    prompt = _build_outline_prompt("Demo", "Prompt", "Context", config)
    assert "6-8" in prompt
    assert "5-7" in prompt
    assert "结构模板" in prompt
    assert "主题预设：creative-visual" in prompt
    assert "输出语言：英文" in prompt


def test_markdown_includes_frontmatter_template() -> None:
    outline = SlideOutline(
        title="Demo",
        slides=[SlideOutlineItem(title="Intro", bullets=["A"])],
    )
    config = SlideGenerationConfig(theme_preset="business-brief")
    markdown = build_markdown_from_outline(outline, config)
    assert markdown.startswith("---")
    assert "transition: \"slide-left\"" in markdown


def test_markdown_respects_frontmatter_override() -> None:
    outline = SlideOutline(
        title="Demo",
        slides=[SlideOutlineItem(title="Intro", bullets=["A"])],
    )
    config = SlideGenerationConfig(frontmatter="theme: custom\ntransition: zoom")
    markdown = build_markdown_from_outline(outline, config)
    assert "theme: custom" in markdown
    assert "transition: zoom" in markdown


@pytest.mark.asyncio
async def test_generate_outline_uses_model_id(test_settings, monkeypatch) -> None:
    called: dict[str, str] = {}

    def fake_build_chat_model_from_model_id(_settings, model_id: str):
        called["model_id"] = model_id
        return TestModel()

    async def fake_resolve_context(*_args, **_kwargs):
        return generator.SlidesContext(context="", resolved_chunk_ids=[])

    monkeypatch.setattr(generator, "build_chat_model_from_model_id", fake_build_chat_model_from_model_id)
    monkeypatch.setattr(generator, "_resolve_context", fake_resolve_context)

    deps = StudioDeps(
        settings=test_settings,
        session=object(),  # not used due to patched _resolve_context
        vector_store=object(),
        embedder=object(),
    )

    await generator.generate_slides_outline(
        deps,
        notebook_id=1,
        title="Demo",
        prompt=None,
        chunk_ids=None,
        generation_config=None,
        model_id="test-chat",
    )
    assert called["model_id"] == "test-chat"
