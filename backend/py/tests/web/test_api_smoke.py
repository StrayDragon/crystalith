from __future__ import annotations

import asyncio

import pytest
from httpx import ASGITransport, AsyncClient

from crystalith.shared.db import Chunk, Source, create_db_manager
from crystalith.shared.db.migrations import upgrade_head
from crystalith.shared.types import SourceStatus
from crystalith.shared.vector_storage import InMemoryVectorStore
from crystalith.web.app import create_app


def _assert_error_envelope(response, expected_error_code: str) -> dict:
    payload = response.json()
    assert payload["error_code"] == expected_error_code
    assert isinstance(payload.get("message"), str)
    assert payload["message"]
    return payload


@pytest.mark.asyncio
async def test_api_smoke_health_notebook_and_analysis_404(client) -> None:
    health = await client.get("/health")
    assert health.status_code == 200
    assert health.json() == {"status": "ok"}

    dependency_health = await client.get("/health/dependencies")
    assert dependency_health.status_code == 200
    payload = dependency_health.json()
    assert payload["status"] == "ok"
    assert payload["last_probe"] is not None
    assert payload["core"]["frontend"]["service"] == "web"
    assert payload["core"]["backend"]["service"] == "api"
    assert payload["optional"]["storage_chroma"]["status"] in {"disabled", "unknown", "healthy", "degraded"}
    assert "optional" in payload

    create_resp = await client.post("/v1/notebooks", json={"name": "Smoke Notebook"})
    assert create_resp.status_code == 201
    notebook_id = create_resp.json()["id"]
    assert isinstance(notebook_id, int)

    list_resp = await client.get("/v1/notebooks")
    assert list_resp.status_code == 200
    notebooks = list_resp.json()
    assert any(item["id"] == notebook_id for item in notebooks)

    empty_analysis = await client.get(f"/v1/notebooks/{notebook_id}/analysis")
    assert empty_analysis.status_code == 200
    assert empty_analysis.json() == {
        "topics": [],
        "relations": [],
        "contradictions": [],
    }

    missing_analysis = await client.get("/v1/notebooks/999999/analysis")
    assert missing_analysis.status_code == 404
    _assert_error_envelope(missing_analysis, "NOT_FOUND")


@pytest.mark.asyncio
async def test_api_smoke_sources_upload_chunks_and_delete(client) -> None:
    create_notebook = await client.post("/v1/notebooks", json={"name": "Sources Smoke"})
    assert create_notebook.status_code == 201
    notebook_id = create_notebook.json()["id"]

    upload = await client.post(
        f"/v1/notebooks/{notebook_id}/sources",
        files={"file": ("smoke.txt", b"alpha\nbeta\ngamma", "text/plain")},
    )
    assert upload.status_code == 201
    source_id = upload.json()["id"]

    list_sources = await client.get(f"/v1/notebooks/{notebook_id}/sources")
    assert list_sources.status_code == 200
    sources = list_sources.json()
    assert any(item["id"] == source_id for item in sources)

    chunks_resp = await client.get(f"/v1/notebooks/{notebook_id}/sources/{source_id}/chunks")
    assert chunks_resp.status_code == 200
    chunks = chunks_resp.json()
    assert chunks
    chunk_indexes = [item["chunk_index"] for item in chunks]
    assert chunk_indexes == sorted(chunk_indexes)

    delete_resp = await client.delete(f"/v1/notebooks/{notebook_id}/sources/{source_id}")
    assert delete_resp.status_code == 204

    list_after_delete = await client.get(f"/v1/notebooks/{notebook_id}/sources")
    assert list_after_delete.status_code == 200
    assert all(item["id"] != source_id for item in list_after_delete.json())


@pytest.mark.asyncio
async def test_api_smoke_error_envelope_contracts(client) -> None:
    validation_error = await client.post("/v1/notebooks", json={})
    assert validation_error.status_code == 422
    validation_payload = _assert_error_envelope(validation_error, "VALIDATION_ERROR")
    assert isinstance(validation_payload.get("details"), list)
    assert validation_payload["details"]

    create_notebook = await client.post("/v1/notebooks", json={"name": "Errors Smoke"})
    assert create_notebook.status_code == 201
    notebook_id = create_notebook.json()["id"]

    empty_upload = await client.post(
        f"/v1/notebooks/{notebook_id}/sources",
        files={"file": ("empty.txt", b"", "text/plain")},
    )
    assert empty_upload.status_code == 400
    _assert_error_envelope(empty_upload, "BAD_REQUEST")

    missing_notebook_sources = await client.get("/v1/notebooks/999999/sources")
    assert missing_notebook_sources.status_code == 404
    _assert_error_envelope(missing_notebook_sources, "NOT_FOUND")


@pytest.mark.asyncio
async def test_api_smoke_dependency_health_optional_failure_is_recoverable(client, app) -> None:
    app.state.settings.optional_services.redis.enabled = True
    app.state.settings.optional_services.redis.endpoint = "redis://127.0.0.1:1/0"
    app.state.settings.optional_services.redis.probe.enabled = True
    app.state.optional_services_last_probe = None

    dependency_health = await client.get("/health/dependencies")
    assert dependency_health.status_code == 200
    payload = dependency_health.json()

    redis_status = payload["optional"]["cache_redis"]
    assert redis_status["enabled"] is True
    assert redis_status["status"] == "degraded"
    assert redis_status["healthy"] is False
    assert redis_status["error_code"] == "REDIS_UNAVAILABLE"
    assert isinstance(redis_status["recovery_hint"], str)
    assert redis_status["recovery_hint"]

    health = await client.get("/health")
    assert health.status_code == 200
    assert health.json() == {"status": "ok"}


@pytest.mark.asyncio
async def test_api_smoke_dependency_health_refreshes_when_monitor_disabled(
    test_settings,
    tmp_path,
    monkeypatch,
) -> None:
    calls = {"refresh": 0}

    async def _refresh(_app, *, timeout_s: float) -> None:
        calls["refresh"] += 1
        _app.state.optional_services_last_probe = f"probe-{calls['refresh']}"

    # Mock reason: avoid hitting real optional services probe/monitoring during smoke tests.
    monkeypatch.setenv("CRYSTALITH_OPTIONAL_SERVICES_MONITOR_ENABLED", "0")

    db_path = tmp_path / "test.db"
    db_url = f"sqlite+aiosqlite:///{db_path}"
    await asyncio.to_thread(upgrade_head, db_url)
    manager = create_db_manager(db_url)
    try:
        app = create_app(
            settings=test_settings,
            db_manager=manager,
            vector_store=InMemoryVectorStore(),
            optional_services_refresher=_refresh,
        )
        app.state.optional_services_last_probe = "stale"

        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            first = await client.get("/health/dependencies")
            second = await client.get("/health/dependencies")
    finally:
        await manager.close()

    assert first.status_code == 200
    assert second.status_code == 200
    assert calls["refresh"] == 2


@pytest.mark.asyncio
async def test_api_smoke_dependency_health_searxng_prefers_explicit_host(test_settings, tmp_path) -> None:
    calls: list[tuple[str | None, float, str | None, frozenset[int]]] = []

    def _probe(
        endpoint: str | None,
        *,
        timeout_s: float,
        path: str | None = None,
        healthy_status_codes: set[int] | None = None,
    ) -> tuple[bool, str | None]:
        calls.append((endpoint, timeout_s, path, frozenset(healthy_status_codes or set())))
        return True, None

    db_path = tmp_path / "test.db"
    db_url = f"sqlite+aiosqlite:///{db_path}"
    await asyncio.to_thread(upgrade_head, db_url)
    manager = create_db_manager(db_url)
    try:
        app = create_app(
            settings=test_settings,
            db_manager=manager,
            vector_store=InMemoryVectorStore(),
            http_endpoint_prober=_probe,
        )
        app.state.settings.search.searxng.host = "http://preferred-searx.test"
        app.state.settings.search.searxng.endpoint_candidates = ["http://candidate-searx.test"]
        app.state.settings.optional_services.searxng.enabled = True
        app.state.settings.optional_services.searxng.endpoint = "http://optional-searx.test"
        app.state.settings.optional_services.searxng.endpoint_candidates = ["http://optional-candidate.test"]
        app.state.settings.optional_services.searxng.probe.enabled = True
        app.state.settings.optional_services.searxng.probe.path = "/search?q=&format=json"

        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            response = await client.get("/health/dependencies?force=1")
            assert response.status_code == 200
            payload = response.json()["optional"]["search_searxng"]
    finally:
        await manager.close()

    assert payload["endpoint"] == "http://preferred-searx.test"
    assert payload["healthy"] is True
    assert calls == [
        (
            "http://preferred-searx.test",
            10.0,
            "/search?q=&format=json",
            frozenset({400}),
        )
    ]


@pytest.mark.asyncio
async def test_api_smoke_dependency_health_force_refreshes_when_monitor_enabled(
    test_settings,
    tmp_path,
    monkeypatch,
) -> None:
    calls = {"refresh": 0}

    async def _refresh(_app, *, timeout_s: float) -> None:
        calls["refresh"] += 1
        _app.state.optional_services_last_probe = f"force-{calls['refresh']}"

    # Mock reason: avoid hitting real optional services probe/monitoring during smoke tests.
    monkeypatch.setenv("CRYSTALITH_OPTIONAL_SERVICES_MONITOR_ENABLED", "1")

    db_path = tmp_path / "test.db"
    db_url = f"sqlite+aiosqlite:///{db_path}"
    await asyncio.to_thread(upgrade_head, db_url)
    manager = create_db_manager(db_url)
    try:
        app = create_app(
            settings=test_settings,
            db_manager=manager,
            vector_store=InMemoryVectorStore(),
            optional_services_refresher=_refresh,
        )
        app.state.optional_services_last_probe = "cached"

        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            cached = await client.get("/health/dependencies")
            forced = await client.get("/health/dependencies?force=1")
            forced_again = await client.get("/health/dependencies?force=true")
    finally:
        await manager.close()

    assert cached.status_code == 200
    assert forced.status_code == 200
    assert forced_again.status_code == 200
    assert calls["refresh"] == 2
    assert forced.json()["last_probe"] == "force-1"
    assert forced_again.json()["last_probe"] == "force-2"


@pytest.mark.asyncio
async def test_api_smoke_qa_and_outputs_contract(client, db_session, app) -> None:
    create_notebook = await client.post("/v1/notebooks", json={"name": "Outputs QA Smoke"})
    assert create_notebook.status_code == 201
    notebook_id = create_notebook.json()["id"]

    source = Source(
        notebook_id=notebook_id,
        filename="smoke.md",
        status=SourceStatus.READY,
    )
    db_session.add(source)
    await db_session.flush()

    chunk = Chunk(
        source_id=source.id,
        chunk_index=0,
        text="Smoke chunk for QA and outputs.",
    )
    db_session.add(chunk)
    await db_session.commit()

    await app.state.vector_store.add(
        notebook_id=notebook_id,
        source_id=source.id,
        chunk_ids=[chunk.id],
        vectors=[[1.0, 0.0, 0.0]],
    )

    qa_resp = await client.post(
        f"/v1/notebooks/{notebook_id}/qa",
        json={"question": "smoke question", "source_ids": [source.id]},
    )
    assert qa_resp.status_code == 200
    qa_payload = qa_resp.json()
    assert isinstance(qa_payload.get("answer"), str)
    assert isinstance(qa_payload.get("evidence"), bool)
    assert isinstance(qa_payload.get("citations"), list)

    create_output = await client.post(
        f"/v1/notebooks/{notebook_id}/outputs/BULLETS",
        json={"prompt": "summarize", "source_ids": [source.id]},
    )
    assert create_output.status_code == 201
    output_payload = create_output.json()
    assert isinstance(output_payload.get("id"), int)
    assert output_payload["type"] == "BULLETS"
    assert isinstance(output_payload.get("content"), dict)

    bad_output = await client.post(
        f"/v1/notebooks/{notebook_id}/outputs/BULLETS",
        json={"prompt": "x", "source_ids": []},
    )
    assert bad_output.status_code == 400
    _assert_error_envelope(bad_output, "BAD_REQUEST")

    missing_output = await client.get("/v1/notebooks/999999/outputs")
    assert missing_output.status_code == 404
    _assert_error_envelope(missing_output, "NOT_FOUND")
