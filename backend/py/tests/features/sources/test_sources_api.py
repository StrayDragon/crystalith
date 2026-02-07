from __future__ import annotations

import asyncio
import time
from time import perf_counter
from types import SimpleNamespace

import pytest

from crystalith.shared.parsers.factory import ParserFactory


class _SlowParser:
    parser_type = "text"
    page_count = None

    def parse(self, content: bytes):
        time.sleep(0.35)
        text = content.decode("utf-8", errors="ignore") or "slow"
        return [
            SimpleNamespace(
                text=text,
                start_offset=0,
                end_offset=len(text),
                metadata={},
            )
        ]


@pytest.mark.asyncio
async def test_sources_crud(client):
    notebook_resp = await client.post("/v1/notebooks", json={"name": "Notebook"})
    assert notebook_resp.status_code == 201
    notebook_id = notebook_resp.json()["id"]

    files = {"file": ("note.txt", b"Hello world", "text/plain")}
    create_resp = await client.post(
        f"/v1/notebooks/{notebook_id}/sources",
        files=files,
    )
    assert create_resp.status_code == 201
    payload = create_resp.json()
    source_id = payload["id"]
    assert payload["chunk_count"] >= 1

    list_resp = await client.get(f"/v1/notebooks/{notebook_id}/sources")
    assert list_resp.status_code == 200
    assert len(list_resp.json()) == 1

    chunks_resp = await client.get(
        f"/v1/notebooks/{notebook_id}/sources/{source_id}/chunks"
    )
    assert chunks_resp.status_code == 200
    assert len(chunks_resp.json()) >= 1

    delete_resp = await client.delete(
        f"/v1/notebooks/{notebook_id}/sources/{source_id}"
    )
    assert delete_resp.status_code == 204

    after_resp = await client.get(f"/v1/notebooks/{notebook_id}/sources")
    assert after_resp.status_code == 200
    assert after_resp.json() == []


@pytest.mark.asyncio
async def test_upload_source_parse_runs_in_executor_without_blocking_requests(client, monkeypatch):
    notebook_resp = await client.post("/v1/notebooks", json={"name": "Slow Parse Notebook"})
    assert notebook_resp.status_code == 201
    notebook_id = notebook_resp.json()["id"]

    def _from_file(
        cls,  # noqa: ANN001
        *,
        filename: str | None,
        mime_type: str | None,
        transcriber=None,  # noqa: ANN001
        media_fetcher=None,  # noqa: ANN001
    ):
        return _SlowParser()

    monkeypatch.setattr(ParserFactory, "from_file", classmethod(_from_file))

    started = perf_counter()
    upload_task = asyncio.create_task(
        client.post(
            f"/v1/notebooks/{notebook_id}/sources",
            files={"file": ("slow.txt", b"A" * 1024, "text/plain")},
        )
    )

    await asyncio.sleep(0.02)

    quick_started = perf_counter()
    quick_resp = await client.post("/v1/notebooks", json={"name": "Quick Notebook"})
    quick_elapsed = perf_counter() - quick_started

    upload_resp = await upload_task
    total_elapsed = perf_counter() - started

    assert upload_resp.status_code == 201
    assert quick_resp.status_code == 201
    assert total_elapsed >= 0.3
    assert quick_elapsed < 0.25
