from __future__ import annotations

import pytest

from crystalith.shared.agents.output_graph import (
    _ensure_minimum_content,
    _fallback_output,
    _map_citations,
    _normalize_source_ids,
    _resolve_citation_indices,
    _resolve_citations,
    _validate_source_ids,
)
from crystalith.shared.db import Notebook, Source
from crystalith.shared.schemas.citations import Citation
from crystalith.shared.types import OutputType, SourceStatus


def test_resolve_citation_indices_filters_invalid_values() -> None:
    assert _resolve_citation_indices("nope") == []
    assert _resolve_citation_indices([1, "2", "bad", None, -1, 0]) == [1, 2]


def test_resolve_citations_falls_back_when_indices_missing() -> None:
    cit = Citation(
        source_id=1,
        source_name="Doc.md",
        chunk_id=10,
        chunk_index=0,
        snippet="hello",
        score=0.9,
    )
    mapped = _resolve_citations([99], citation_map={1: cit}, fallback=[cit])
    assert mapped and mapped[0]["source_id"] == 1


def test_map_citations_recurses_and_replaces_citations_fields() -> None:
    cit1 = Citation(
        source_id=1,
        source_name="Doc.md",
        chunk_id=10,
        chunk_index=0,
        snippet="hello",
        score=0.9,
    )
    cit2 = Citation(
        source_id=2,
        source_name="Other.md",
        chunk_id=11,
        chunk_index=1,
        snippet="world",
        score=0.8,
    )
    payload = {
        "items": [
            {"text": "a", "citations": [1, "2", "bad"]},
            {"text": "b", "citations": []},
        ]
    }
    mapped = _map_citations(payload, citation_map={1: cit1, 2: cit2}, fallback=[cit1])
    assert mapped["items"][0]["citations"][0]["source_id"] == 1
    assert mapped["items"][0]["citations"][1]["source_id"] == 2
    # Empty citations falls back to first citation when provided.
    assert mapped["items"][1]["citations"][0]["source_id"] == 1


def test_normalize_source_ids_dedupes_and_validates() -> None:
    assert _normalize_source_ids(None) == []
    assert _normalize_source_ids([3, 3, 2]) == [3, 2]
    with pytest.raises(ValueError, match="Unknown source_id"):
        _normalize_source_ids([0])


@pytest.mark.asyncio
async def test_validate_source_ids_raises_for_unknown(db_session) -> None:
    notebook = Notebook(name="N")
    db_session.add(notebook)
    await db_session.commit()
    await db_session.refresh(notebook)

    source = Source(
        notebook_id=notebook.id,
        filename="Doc.md",
        status=SourceStatus.READY,
    )
    db_session.add(source)
    await db_session.commit()

    await _validate_source_ids(db_session, notebook.id, [source.id])
    with pytest.raises(ValueError, match="Unknown source_id"):
        await _validate_source_ids(db_session, notebook.id, [source.id + 999])


@pytest.mark.parametrize(
    "output_type",
    [
        OutputType.FAQ,
        OutputType.GUIDE,
        OutputType.TIMELINE,
        OutputType.MINDMAP,
        OutputType.QUIZ,
        OutputType.BRIEFING,
        OutputType.PARAGRAPH,
        OutputType.BULLETS,
        OutputType.STRUCTURED,
    ],
)
def test_fallback_output_shapes(output_type: OutputType) -> None:
    fallback = _fallback_output(output_type, "Prompt")
    assert fallback.get("_fallback") is True


def test_ensure_minimum_content_normalizes_known_shapes() -> None:
    prompt = "P"

    paragraph = _ensure_minimum_content(OutputType.PARAGRAPH, {"text": "x"}, prompt)
    assert paragraph["citations"] == [1]

    mindmap = _ensure_minimum_content(OutputType.MINDMAP, {"root": {"label": "L"}}, prompt)
    assert mindmap["root"]["citations"] == [1]
    assert mindmap["root"]["children"]

    guide = _ensure_minimum_content(OutputType.GUIDE, {"modules": [{}]}, prompt)
    assert guide["modules"][0]["objective"]
    assert guide["modules"][0]["key_points"]

    briefing = _ensure_minimum_content(OutputType.BRIEFING, {"sections": [{"heading": "H"}]}, prompt)
    assert briefing["sections"][0]["points"]

    structured = _ensure_minimum_content(OutputType.STRUCTURED, {"title": "T", "bullets": []}, prompt)
    assert structured.get("_fallback") is True

    invalid = _ensure_minimum_content(OutputType.QUIZ, content="nope", prompt=prompt)
    assert invalid.get("_fallback") is True
