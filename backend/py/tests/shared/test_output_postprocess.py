from __future__ import annotations

import pytest

from crystalith.shared.agents.output_postprocess import postprocess_output
from crystalith.shared.types import OutputType


def test_postprocess_output_sanitizes_citations_indices() -> None:
    content = {"text": "x", "citations": [1, "2", "bad", None, -1, 0, 999, 2]}
    result = postprocess_output(
        output_type=OutputType.PARAGRAPH,
        content=content,
        prompt_title="P",
        citations_count=2,
    )

    assert result.content["citations"] == [1, 2]
    assert result.content["_postprocessed"] is True
    assert "citations_sanitized" in result.warnings


def test_postprocess_output_applies_fallback_when_minimum_content_missing() -> None:
    result = postprocess_output(
        output_type=OutputType.BULLETS,
        content={"items": []},
        prompt_title="P",
        citations_count=1,
    )
    assert result.content.get("_fallback") is True


def test_postprocess_output_skips_structural_fixes_for_plugin_payloads() -> None:
    result = postprocess_output(
        output_type=OutputType.QUIZ,
        content={"value": "ok"},
        prompt_title="P",
        citations_count=0,
        apply_structural=False,
    )
    assert result.content == {"value": "ok", "_postprocessed": True}


@pytest.mark.parametrize(
    ("output_type", "content", "assert_key"),
    [
        (OutputType.FAQ, {"items": []}, "items"),
        (OutputType.GUIDE, {"modules": []}, "modules"),
        (OutputType.TIMELINE, {"events": []}, "events"),
        (OutputType.MINDMAP, {"root": {"label": "L"}}, "root"),
        (OutputType.QUIZ, {"questions": []}, "questions"),
        (OutputType.BRIEFING, {"sections": [{"heading": "H"}]}, "sections"),
        (OutputType.PARAGRAPH, {"text": "x"}, "text"),
        (OutputType.BULLETS, {"items": []}, "items"),
        (OutputType.STRUCTURED, {"title": "T", "bullets": []}, "title"),
    ],
)
def test_postprocess_output_produces_renderable_shapes(
    output_type: OutputType,
    content: dict,
    assert_key: str,
) -> None:
    result = postprocess_output(
        output_type=output_type,
        content=content,
        prompt_title="P",
        citations_count=1,
    )
    assert assert_key in result.content
    assert result.content["_postprocessed"] is True
