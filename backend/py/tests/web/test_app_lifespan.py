from __future__ import annotations

import asyncio
import tempfile
from pathlib import Path

import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy import select

import crystalith.web.app as app_module
from crystalith.shared.config import Settings
from crystalith.shared.db import Notebook, Source, create_db_manager
from crystalith.shared.db.migrations import upgrade_head
from crystalith.shared.types import SourceStatus
from crystalith.shared.vector_storage import InMemoryVectorStore
from crystalith.web.app import create_app


def test_probe_http_endpoint_treats_4xx_as_unhealthy(monkeypatch: pytest.MonkeyPatch) -> None:
    class _DummyResponse:
        status_code = 404

        def __enter__(self):
            return self

        def __exit__(self, exc_type, exc, tb):
            return False

    class _DummyClient:
        def __enter__(self):
            return self

        def __exit__(self, exc_type, exc, tb):
            return False

        def stream(self, method: str, url: str):
            return _DummyResponse()

    monkeypatch.setattr(app_module.httpx, "Client", lambda **kwargs: _DummyClient())
    healthy, error = app_module._probe_http_endpoint("http://service.test", timeout_s=1.0)
    assert healthy is False
    assert error == "HTTP 404"


def test_probe_http_endpoint_accepts_configured_status_codes(monkeypatch: pytest.MonkeyPatch) -> None:
    class _DummyResponse:
        status_code = 400

        def __enter__(self):
            return self

        def __exit__(self, exc_type, exc, tb):
            return False

    class _DummyClient:
        def __enter__(self):
            return self

        def __exit__(self, exc_type, exc, tb):
            return False

        def stream(self, method: str, url: str):
            return _DummyResponse()

    monkeypatch.setattr(app_module.httpx, "Client", lambda **kwargs: _DummyClient())
    healthy, error = app_module._probe_http_endpoint(
        "http://service.test",
        timeout_s=1.0,
        healthy_status_codes={400},
    )
    assert healthy is True
    assert error is None


async def _create_test_db() -> tuple[tempfile.TemporaryDirectory[str], str]:
    tempdir = tempfile.TemporaryDirectory()
    db_path = Path(tempdir.name) / "test.db"
    db_url = f"sqlite+aiosqlite:///{db_path}"
    await asyncio.to_thread(upgrade_head, db_url)
    return tempdir, db_url


@pytest.mark.asyncio
@pytest.mark.parametrize(
    ("env_value", "settings_value", "should_delete_failed"),
    [
        (None, True, True),
        ("0", True, True),
        ("1", False, False),
    ],
)
async def test_startup_cleanup_failed_sources_ignores_env_override(
    test_settings: Settings,
    monkeypatch: pytest.MonkeyPatch,
    env_value: str | None,
    settings_value: bool,
    should_delete_failed: bool,
) -> None:
    # Mock reason: legacy env override must be ignored in YAML-first config mode.
    if env_value is None:
        monkeypatch.delenv("AUTO_CLEANUP_FAILED_SOURCES", raising=False)
    else:
        monkeypatch.setenv("AUTO_CLEANUP_FAILED_SOURCES", env_value)

    settings = test_settings.model_copy(deep=True)
    settings.app.startup.cleanup_failed_sources = settings_value

    tempdir, db_url = await _create_test_db()
    manager = create_db_manager(db_url)

    try:
        async with manager.got_manual_session() as session:
            notebook = Notebook(name="Startup Cleanup Notebook")
            session.add(notebook)
            await session.flush()

            failed = Source(
                notebook_id=notebook.id,
                filename="failed.txt",
                status=SourceStatus.FAILED,
            )
            ready = Source(
                notebook_id=notebook.id,
                filename="ready.txt",
                status=SourceStatus.READY,
            )
            session.add_all([failed, ready])
            await session.commit()

        app = create_app(settings=settings, db_manager=manager, vector_store=InMemoryVectorStore())

        async with app.router.lifespan_context(app), manager.got_manual_session() as session:
            rows = await session.execute(
                select(Source.filename, Source.status).order_by(Source.filename.asc())
            )
            remaining = list(rows.all())

        filenames = [filename for filename, _status in remaining]

        if should_delete_failed:
            assert filenames == ["ready.txt"]
        else:
            assert filenames == ["failed.txt", "ready.txt"]
    finally:
        await manager.close()
        tempdir.cleanup()


@pytest.mark.asyncio
async def test_cors_allows_configured_origin(test_settings: Settings) -> None:
    settings = test_settings.model_copy(deep=True)
    settings.app.cors.allow_origins = ["http://example.test"]

    tempdir, db_url = await _create_test_db()
    manager = create_db_manager(db_url)
    app = create_app(settings=settings, db_manager=manager, vector_store=InMemoryVectorStore())

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        resp = await client.get("/health", headers={"Origin": "http://example.test"})
        assert resp.status_code == 200
        assert resp.headers.get("access-control-allow-origin") == "http://example.test"

        resp2 = await client.get("/health", headers={"Origin": "http://not-allowed.test"})
        assert resp2.status_code == 200
        assert "access-control-allow-origin" not in resp2.headers

    await manager.close()
    tempdir.cleanup()
