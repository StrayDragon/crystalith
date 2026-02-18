from __future__ import annotations

import datetime

import pytest

from crystalith.features.outputs import repo as outputs_repo
from crystalith.features.outputs import schemas as outputs_schemas
from crystalith.features.outputs import service as outputs_service
from crystalith.features.outputs.api import _extract_text_from_output, _split_text_to_chunks
from crystalith.shared.db import Notebook, Output
from crystalith.shared.types import OutputType


def test_extract_text_from_output_handles_common_types() -> None:
    base = Output(notebook_id=1, type=OutputType.PARAGRAPH, prompt="p", content={"content": "Hello"})
    assert "Hello" in _extract_text_from_output(base)

    bullets = Output(
        notebook_id=1,
        type=OutputType.BULLETS,
        prompt="Summarize",
        content={"items": [{"text": "a"}, {"text": "b"}]},
    )
    extracted = _extract_text_from_output(bullets)
    assert "- a" in extracted
    assert "- b" in extracted

    faq = Output(
        notebook_id=1,
        type=OutputType.FAQ,
        prompt=None,
        content={"items": [{"question": "Q1", "answer": "A1"}]},
    )
    extracted_faq = _extract_text_from_output(faq)
    assert "Q1" in extracted_faq
    assert "A1" in extracted_faq

    timeline = Output(
        notebook_id=1,
        type=OutputType.TIMELINE,
        prompt=None,
        content={"events": [{"date": "2025", "event": "E", "description": "D"}]},
    )
    extracted_tl = _extract_text_from_output(timeline)
    assert "2025" in extracted_tl
    assert "E" in extracted_tl

    mindmap = Output(
        notebook_id=1,
        type=OutputType.MINDMAP,
        prompt=None,
        content={"root": {"label": "Root", "children": [{"label": "Child", "children": []}]}},
    )
    extracted_mm = _extract_text_from_output(mindmap)
    assert "Root" in extracted_mm
    assert "Child" in extracted_mm

    structured = Output(
        notebook_id=1,
        type=OutputType.STRUCTURED,
        prompt=None,
        content={"bullets": [{"text": "x"}], "terms": ["t1"]},
    )
    extracted_structured = _extract_text_from_output(structured)
    assert "- x" in extracted_structured
    assert "术语" in extracted_structured
    assert "t1" in extracted_structured


def test_extract_text_from_output_handles_additional_types_and_legacy_formats() -> None:
    paragraph_text = Output(
        notebook_id=1,
        type=OutputType.PARAGRAPH,
        prompt=None,
        content={"text": "Hello text"},
    )
    assert "Hello text" in _extract_text_from_output(paragraph_text)

    legacy_bullets = Output(
        notebook_id=1,
        type=OutputType.BULLETS,
        prompt=None,
        content={"bullets": ["a", "", "b"]},
    )
    extracted_legacy = _extract_text_from_output(legacy_bullets)
    assert "- a" in extracted_legacy
    assert "- b" in extracted_legacy

    mixed_bullets = Output(
        notebook_id=1,
        type=OutputType.BULLETS,
        prompt=None,
        content={"items": ["s", {"text": "d"}, 123]},
    )
    extracted_mixed = _extract_text_from_output(mixed_bullets)
    assert "- s" in extracted_mixed
    assert "- d" in extracted_mixed

    quiz = Output(
        notebook_id=1,
        type=OutputType.QUIZ,
        prompt=None,
        content={
            "questions": [
                {"question": "Q1", "options": ["A", "B"], "answer": "A"},
            ]
        },
    )
    extracted_quiz = _extract_text_from_output(quiz)
    assert "Q1" in extracted_quiz
    assert "答案" in extracted_quiz

    guide_modules = Output(
        notebook_id=1,
        type=OutputType.GUIDE,
        prompt=None,
        content={
            "modules": [
                {
                    "title": "M1",
                    "objective": {"text": "Obj"},
                    "key_points": [{"text": "P1"}, "P2"],
                },
            ]
        },
    )
    extracted_guide_modules = _extract_text_from_output(guide_modules)
    assert "## M1" in extracted_guide_modules
    assert "Obj" in extracted_guide_modules
    assert "- P1" in extracted_guide_modules
    assert "- P2" in extracted_guide_modules

    guide_sections = Output(
        notebook_id=1,
        type=OutputType.GUIDE,
        prompt=None,
        content={"sections": [{"title": "S1", "body": "B1"}]},
    )
    extracted_guide_sections = _extract_text_from_output(guide_sections)
    assert "## S1" in extracted_guide_sections
    assert "B1" in extracted_guide_sections

    briefing_sections = Output(
        notebook_id=1,
        type=OutputType.BRIEFING,
        prompt=None,
        content={"sections": [{"heading": "H", "points": [{"text": "p"}]}]},
    )
    extracted_briefing = _extract_text_from_output(briefing_sections)
    assert "## H" in extracted_briefing
    assert "- p" in extracted_briefing

    slides_outline = Output(
        notebook_id=1,
        type=OutputType.SLIDES,
        prompt=None,
        content={"outline": {"title": "Deck", "slides": [{"title": "S", "bullets": ["b"]}]}},
    )
    extracted_slides = _extract_text_from_output(slides_outline)
    assert "Deck" in extracted_slides
    assert "幻灯片" not in extracted_slides
    assert "- b" in extracted_slides

    structured_sections = Output(
        notebook_id=1,
        type=OutputType.STRUCTURED,
        prompt=None,
        content={"sections": [{"title": "T", "content": "C"}]},
    )
    extracted_sections = _extract_text_from_output(structured_sections)
    assert "## T" in extracted_sections
    assert "C" in extracted_sections


def test_extract_text_from_output_falls_back_to_prompt_and_json() -> None:
    out = Output(notebook_id=1, type=OutputType.PARAGRAPH, prompt="Only prompt", content={})
    assert "Only prompt" in _extract_text_from_output(out)

    out2 = Output(notebook_id=1, type=OutputType.STRUCTURED, prompt=None, content={"unknown": 1})
    extracted = _extract_text_from_output(out2)
    assert "unknown" in extracted

    out3 = Output(notebook_id=1, type=OutputType.PARAGRAPH, prompt=None, content={"body": "Body"})
    assert "Body" in _extract_text_from_output(out3)


def test_split_text_to_chunks_splits_long_paragraphs_and_keeps_non_empty() -> None:
    chunks = _split_text_to_chunks("a" * 1200, chunk_size=300, overlap=50)
    assert chunks
    assert all(chunk for chunk in chunks)
    assert all(len(chunk) <= 300 for chunk in chunks)

    chunks2 = _split_text_to_chunks("p1\n\np2\n\np3", chunk_size=10)
    assert chunks2


@pytest.mark.asyncio
async def test_outputs_repo_and_service_roundtrip(db_session) -> None:
    notebook = Notebook(name="Outputs Repo Notebook")
    db_session.add(notebook)
    await db_session.commit()
    await db_session.refresh(notebook)

    created = await outputs_service.create_output(
        db_session,
        notebook_id=notebook.id,
        output_type=OutputType.PARAGRAPH,
        prompt="Hello",
        content=None,
    )
    assert created.notebook_id == notebook.id
    assert created.content["content"] == "Hello"

    items = await outputs_repo.list_outputs(db_session, notebook_id=notebook.id, offset=0, limit=10)
    assert [item.id for item in items] == [created.id]

    fetched = await outputs_repo.get_output(db_session, created.id)
    assert fetched is not None

    read = outputs_schemas.OutputRead.model_validate(created)
    assert read.id == created.id
    assert read.type == OutputType.PARAGRAPH

    await outputs_repo.delete_output(db_session, created)
    assert await outputs_repo.get_output(db_session, created.id) is None


def test_output_schemas_accept_minimal_generate_request() -> None:
    req = outputs_schemas.OutputGenerateRequest(prompt="x", content=None)
    assert req.prompt == "x"


def test_extract_text_from_output_uses_title_when_present() -> None:
    out = Output(
        notebook_id=1,
        type=OutputType.BRIEFING,
        prompt=None,
        content={"title": "T", "summary": "S"},
        created_at=datetime.datetime.now(datetime.UTC),
        updated_at=datetime.datetime.now(datetime.UTC),
    )
    extracted = _extract_text_from_output(out)
    assert "# T" in extracted
    assert "S" in extracted
