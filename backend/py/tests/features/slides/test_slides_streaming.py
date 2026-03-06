from __future__ import annotations

import datetime
import json

import pytest

from crystalith.shared.db import Chunk, Source, StudioSlide
from crystalith.shared.types import SlideStage, SlideStatus, SourceStatus


async def _read_sse_until_event(response, *, want_event: str, limit: int = 200) -> list[str]:
    lines: list[str] = []
    saw_event = False
    async for line in response.aiter_lines():
        if line:
            lines.append(line)
        if line.startswith(f"event: {want_event}"):
            saw_event = True
            continue
        if saw_event and line.startswith("data:"):
            lines.append(line)
            return lines
        if len(lines) >= limit:
            break
    return lines


@pytest.mark.asyncio
async def test_slide_outline_and_markdown_streams_complete(client, app, db_session) -> None:
    notebook_resp = await client.post("/v1/notebooks", json={"name": "Slides Stream"})
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

    create_resp = await client.post(
        f"/v1/notebooks/{notebook_id}/slides/drafts",
        json={"title": "Deck", "prompt": "Summarize", "source_ids": [source.id]},
    )
    assert create_resp.status_code == 201
    slide_id = create_resp.json()["id"]

    async with client.stream(
        "GET",
        f"/v1/notebooks/{notebook_id}/slides/drafts/{slide_id}/outline/stream",
    ) as response:
        assert response.status_code == 200
        lines = await _read_sse_until_event(response, want_event="done")
        assert any("event: progress" in line for line in lines)

    draft = await client.get(f"/v1/notebooks/{notebook_id}/slides/drafts/{slide_id}")
    assert draft.status_code == 200
    assert draft.json()["outline"]
    assert draft.json()["status"] == SlideStatus.IDLE.value

    async with client.stream(
        "GET",
        f"/v1/notebooks/{notebook_id}/slides/drafts/{slide_id}/markdown/stream",
    ) as response:
        assert response.status_code == 200
        lines = await _read_sse_until_event(response, want_event="done")
        assert any("event: progress" in line for line in lines)

    draft2 = await client.get(f"/v1/notebooks/{notebook_id}/slides/drafts/{slide_id}")
    assert draft2.status_code == 200
    payload = draft2.json()
    assert payload["markdown"]
    assert payload["output_id"]


@pytest.mark.asyncio
async def test_slide_sse_done_includes_timings_when_enabled(client, app, db_session, monkeypatch) -> None:
    # Mock reason: this env flag is the supported switch for enabling SSE timing payloads.
    monkeypatch.setenv("CRYSTALITH_OBSERVABILITY_SSE_TIMINGS", "1")

    notebook_resp = await client.post("/v1/notebooks", json={"name": "Slides Timings"})
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

    create_resp = await client.post(
        f"/v1/notebooks/{notebook_id}/slides/drafts",
        json={"title": "Deck", "prompt": "Summarize", "source_ids": [source.id]},
    )
    assert create_resp.status_code == 201
    slide_id = create_resp.json()["id"]

    async with client.stream(
        "GET",
        f"/v1/notebooks/{notebook_id}/slides/drafts/{slide_id}/outline/stream",
    ) as response:
        assert response.status_code == 200
        lines = await _read_sse_until_event(response, want_event="done")
        done_line = next((line for line in reversed(lines) if line.startswith("data:")), "")
        payload = done_line.removeprefix("data:").strip()
        data = {} if not payload else json.loads(payload)
        assert "timings_ms" in data
        assert isinstance(data["timings_ms"].get("total_ms"), int)
        assert isinstance(data["timings_ms"].get("generate_ms"), int)
        assert isinstance(data["timings_ms"].get("persist_ms"), int)


@pytest.mark.asyncio
async def test_slide_markdown_stream_requires_outline(client, db_session) -> None:
    notebook_resp = await client.post("/v1/notebooks", json={"name": "Slides Stream 2"})
    assert notebook_resp.status_code == 201
    notebook_id = notebook_resp.json()["id"]

    source = Source(notebook_id=notebook_id, filename="Doc.md", status=SourceStatus.READY)
    db_session.add(source)
    await db_session.commit()
    await db_session.refresh(source)

    create_resp = await client.post(
        f"/v1/notebooks/{notebook_id}/slides/drafts",
        json={"title": "Deck", "source_ids": [source.id]},
    )
    assert create_resp.status_code == 201
    slide_id = create_resp.json()["id"]

    async with client.stream(
        "GET",
        f"/v1/notebooks/{notebook_id}/slides/drafts/{slide_id}/markdown/stream",
    ) as response:
        assert response.status_code == 200
        lines = await _read_sse_until_event(response, want_event="error")
        assert any("尚未生成大纲" in line for line in lines)


@pytest.mark.asyncio
async def test_slide_outline_stream_busy_and_stale_clear(client, db_session) -> None:
    notebook_resp = await client.post("/v1/notebooks", json={"name": "Slides Busy"})
    assert notebook_resp.status_code == 201
    notebook_id = notebook_resp.json()["id"]

    source = Source(notebook_id=notebook_id, filename="Doc.md", status=SourceStatus.READY)
    db_session.add(source)
    await db_session.commit()
    await db_session.refresh(source)

    slide = StudioSlide(
        notebook_id=notebook_id,
        title="Deck",
        prompt="p",
        engine="slidev",
        source_ids=[source.id],
        stage=SlideStage.INPUT,
        status=SlideStatus.RUNNING,
        updated_at=datetime.datetime.now(datetime.UTC).replace(tzinfo=None),
    )
    db_session.add(slide)
    await db_session.commit()
    await db_session.refresh(slide)

    # Busy: running and not stale => yields busy event and returns.
    async with client.stream(
        "GET",
        f"/v1/notebooks/{notebook_id}/slides/drafts/{slide.id}/outline/stream",
    ) as response:
        assert response.status_code == 200
        lines = await _read_sse_until_event(response, want_event="busy")
        assert any("演示正在生成中" in line for line in lines)

    # Make stale and ensure it clears then proceeds past busy gate.
    slide = await db_session.get(StudioSlide, slide.id)
    assert slide is not None
    slide.updated_at = (datetime.datetime.now(datetime.UTC) - datetime.timedelta(minutes=20)).replace(tzinfo=None)
    await db_session.commit()

    async with client.stream(
        "GET",
        f"/v1/notebooks/{notebook_id}/slides/drafts/{slide.id}/outline/stream",
    ) as response:
        assert response.status_code == 200
        lines = await _read_sse_until_event(response, want_event="done")
        assert any("event: progress" in line for line in lines)



@pytest.mark.asyncio
async def test_slide_outline_stream_returns_unavailable_detail_when_plugin_missing(client, app, db_session) -> None:
    from crystalith.shared.plugins import PluginRegistry

    notebook_resp = await client.post("/v1/notebooks", json={"name": "Slides Missing Plugin Stream"})
    assert notebook_resp.status_code == 201
    notebook_id = notebook_resp.json()["id"]

    source = Source(notebook_id=notebook_id, filename="Doc.md", status=SourceStatus.READY)
    db_session.add(source)
    await db_session.commit()
    await db_session.refresh(source)

    slide = StudioSlide(
        notebook_id=notebook_id,
        title="Deck",
        prompt="p",
        engine="slidev",
        source_ids=[source.id],
        stage=SlideStage.INPUT,
        status=SlideStatus.IDLE,
    )
    db_session.add(slide)
    await db_session.commit()
    await db_session.refresh(slide)

    original_plugins = app.state.plugins
    app.state.plugins = PluginRegistry()
    try:
        response = await client.get(
            f"/v1/notebooks/{notebook_id}/slides/drafts/{slide.id}/outline/stream",
        )
    finally:
        app.state.plugins = original_plugins

    assert response.status_code == 409
    detail = response.json(); detail = detail.get("detail", detail)
    assert detail["error_code"] == "slides_plugin_required"
    assert "hint" in detail
