from __future__ import annotations

import asyncio
from pathlib import Path

import pytest
from httpx import ASGITransport, AsyncClient

from crystalith.shared.config import Settings
from crystalith.shared.db import create_db_manager
from crystalith.shared.db.migrations import upgrade_head
from tests.helpers.vector_store import InMemoryVectorStore
from crystalith.web.app import create_app


def _assert_error_envelope(response, expected_error_code: str) -> dict:
    payload = response.json()
    assert payload["error_code"] == expected_error_code
    assert isinstance(payload.get("message"), str)
    assert payload["message"]
    return payload


@pytest.mark.asyncio
async def test_http_guardrails_upload_rejects_oversized_without_creating_source(
    test_settings: Settings,
    tmp_path: Path,
) -> None:
    settings = test_settings.model_copy(deep=True)
    settings.app.http_guardrails.mode = "enabled"
    settings.app.http_guardrails.upload_max_bytes = 8
    settings.app.http_guardrails.rate_limit.enabled = False

    db_path = tmp_path / "test.db"
    db_url = f"sqlite+aiosqlite:///{db_path}"
    await asyncio.to_thread(upgrade_head, db_url)
    manager = create_db_manager(db_url)
    try:
        app = create_app(settings=settings, db_manager=manager, vector_store=InMemoryVectorStore())
        app.state.plugins.load_from_entry_points(app.state.settings)
        async with manager.got_manual_session() as session:
            from crystalith.features.templates.service import ensure_builtin_templates

            await ensure_builtin_templates(session)

        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            create_notebook = await client.post("/v1/notebooks", json={"name": "Upload Guardrails"})
            assert create_notebook.status_code == 201
            notebook_id = create_notebook.json()["id"]

            oversized = await client.post(
                f"/v1/notebooks/{notebook_id}/sources",
                files={"file": ("big.txt", b"x" * 9, "text/plain")},
            )
            assert oversized.status_code == 413
            payload = _assert_error_envelope(oversized, "PAYLOAD_TOO_LARGE")
            assert payload.get("details") == {"max_bytes": 8}

            list_sources = await client.get(f"/v1/notebooks/{notebook_id}/sources")
            assert list_sources.status_code == 200
            assert list_sources.json() == []

            ok_upload = await client.post(
                f"/v1/notebooks/{notebook_id}/sources",
                files={"file": ("ok.txt", b"x" * 8, "text/plain")},
            )
            assert ok_upload.status_code == 201
            source_id = ok_upload.json()["id"]

            list_after_ok = await client.get(f"/v1/notebooks/{notebook_id}/sources")
            assert list_after_ok.status_code == 200
            assert any(item["id"] == source_id for item in list_after_ok.json())
    finally:
        await manager.close()


@pytest.mark.asyncio
async def test_http_guardrails_auto_mode_disables_for_loopback_host(
    test_settings: Settings,
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    # Mock reason: simulate uvicorn listen host (HOST env) to exercise auto-mode guardrails behavior.
    monkeypatch.setenv("HOST", "127.0.0.1")

    settings = test_settings.model_copy(deep=True)
    settings.app.http_guardrails.mode = "auto"
    settings.app.http_guardrails.upload_max_bytes = 8
    settings.app.http_guardrails.rate_limit.enabled = True
    settings.app.http_guardrails.rate_limit.window_s = 60
    settings.app.http_guardrails.rate_limit.max_requests = 4

    db_path = tmp_path / "test.db"
    db_url = f"sqlite+aiosqlite:///{db_path}"
    await asyncio.to_thread(upgrade_head, db_url)
    manager = create_db_manager(db_url)
    try:
        app = create_app(settings=settings, db_manager=manager, vector_store=InMemoryVectorStore())
        app.state.plugins.load_from_entry_points(app.state.settings)
        async with manager.got_manual_session() as session:
            from crystalith.features.templates.service import ensure_builtin_templates

            await ensure_builtin_templates(session)

        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            create_notebook = await client.post("/v1/notebooks", json={"name": "Auto Loopback"})
            assert create_notebook.status_code == 201
            notebook_id = create_notebook.json()["id"]

            # Upload limit is NOT enforced in auto mode when bound to loopback.
            ok_upload = await client.post(
                f"/v1/notebooks/{notebook_id}/sources",
                files={"file": ("big.txt", b"x" * 9, "text/plain")},
            )
            assert ok_upload.status_code == 201

            # Rate limit middleware is not mounted, so repeated calls should not 429.
            assert (await client.get("/v1/notebooks")).status_code == 200
            assert (await client.get("/v1/notebooks")).status_code == 200
            assert (await client.get("/v1/notebooks")).status_code == 200
    finally:
        await manager.close()


@pytest.mark.asyncio
async def test_http_guardrails_rate_limit_returns_429_with_retry_after_and_health_is_exempt(
    test_settings: Settings,
    tmp_path: Path,
) -> None:
    settings = test_settings.model_copy(deep=True)
    settings.app.http_guardrails.mode = "enabled"
    settings.app.http_guardrails.rate_limit.enabled = True
    settings.app.http_guardrails.rate_limit.window_s = 60
    settings.app.http_guardrails.rate_limit.max_requests = 2

    db_path = tmp_path / "test.db"
    db_url = f"sqlite+aiosqlite:///{db_path}"
    await asyncio.to_thread(upgrade_head, db_url)
    manager = create_db_manager(db_url)
    try:
        app = create_app(settings=settings, db_manager=manager, vector_store=InMemoryVectorStore())
        app.state.plugins.load_from_entry_points(app.state.settings)
        async with manager.got_manual_session() as session:
            from crystalith.features.templates.service import ensure_builtin_templates

            await ensure_builtin_templates(session)

        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            assert (await client.get("/v1/notebooks")).status_code == 200
            assert (await client.get("/v1/notebooks")).status_code == 200

            limited = await client.get("/v1/notebooks")
            assert limited.status_code == 429
            payload = _assert_error_envelope(limited, "RATE_LIMITED")

            retry_after = payload.get("retry_after")
            assert isinstance(retry_after, int)
            assert retry_after >= 0
            assert limited.headers.get("Retry-After") == str(retry_after)

            health = await client.get("/health")
            assert health.status_code == 200
    finally:
        await manager.close()


@pytest.mark.asyncio
async def test_http_guardrails_auto_mode_enables_for_non_loopback_host(
    test_settings: Settings,
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    # Mock reason: simulate uvicorn listen host (HOST env) to exercise auto-mode guardrails behavior.
    monkeypatch.setenv("HOST", "0.0.0.0")

    settings = test_settings.model_copy(deep=True)
    settings.app.http_guardrails.mode = "auto"
    settings.app.http_guardrails.upload_max_bytes = 8
    settings.app.http_guardrails.rate_limit.enabled = True
    settings.app.http_guardrails.rate_limit.window_s = 60
    settings.app.http_guardrails.rate_limit.max_requests = 4

    db_path = tmp_path / "test.db"
    db_url = f"sqlite+aiosqlite:///{db_path}"
    await asyncio.to_thread(upgrade_head, db_url)
    manager = create_db_manager(db_url)
    try:
        app = create_app(settings=settings, db_manager=manager, vector_store=InMemoryVectorStore())
        app.state.plugins.load_from_entry_points(app.state.settings)
        async with manager.got_manual_session() as session:
            from crystalith.features.templates.service import ensure_builtin_templates

            await ensure_builtin_templates(session)

        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            create_notebook = await client.post("/v1/notebooks", json={"name": "Auto Non-Loopback"})
            assert create_notebook.status_code == 201
            notebook_id = create_notebook.json()["id"]

            oversized = await client.post(
                f"/v1/notebooks/{notebook_id}/sources",
                files={"file": ("big.txt", b"x" * 9, "text/plain")},
            )
            assert oversized.status_code == 413
            payload = _assert_error_envelope(oversized, "PAYLOAD_TOO_LARGE")
            assert payload.get("details") == {"max_bytes": 8}

            assert (await client.get("/v1/notebooks")).status_code == 200
            assert (await client.get("/v1/notebooks")).status_code == 200
            limited = await client.get("/v1/notebooks")
            assert limited.status_code == 429
            payload = _assert_error_envelope(limited, "RATE_LIMITED")
            assert limited.headers.get("Retry-After") == str(payload.get("retry_after"))
    finally:
        await manager.close()
