from __future__ import annotations

import asyncio
import tempfile
from pathlib import Path

import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy import select

from crystalith.shared.config import Settings
from crystalith.shared.config.models import ModelConfig
from crystalith.shared.db import Notebook, Source, create_db_manager
from crystalith.shared.db.migrations import upgrade_head
from crystalith.shared.types import SourceStatus
from crystalith.shared.vector_storage import InMemoryVectorStore
import crystalith.web.app as app_module
from crystalith.web.app import create_app


def test_probe_http_endpoint_treats_4xx_as_unhealthy(monkeypatch: pytest.MonkeyPatch) -> None:
    class _DummyResponse:
        status_code = 404

        def __enter__(self):
            return self

        def __exit__(self, exc_type, exc, tb):  # noqa: ANN001, ARG002
            return False

    class _DummyClient:
        def __enter__(self):
            return self

        def __exit__(self, exc_type, exc, tb):  # noqa: ANN001
            return False

        def stream(self, method: str, url: str):  # noqa: ARG002
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

        def __exit__(self, exc_type, exc, tb):  # noqa: ANN001, ARG002
            return False

    class _DummyClient:
        def __enter__(self):
            return self

        def __exit__(self, exc_type, exc, tb):  # noqa: ANN001
            return False

        def stream(self, method: str, url: str):  # noqa: ARG002
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

        async with app.router.lifespan_context(app):
            async with manager.got_manual_session() as session:
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


@pytest.mark.asyncio
async def test_lifespan_starts_ollama_monitor_when_enabled(
    test_settings: Settings,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    settings = test_settings.model_copy(deep=True)
    settings.models.available.append(
        ModelConfig.model_validate(
            {
                "id": "local-embed",
                "provider": "ollama",
                "model": "bge-m3:567m",
                "display_name": "Local Embed",
                "roles": ["embed"],
                "provider_config": {"host": "http://localhost:11434"},
            }
        )
    )
    settings.models.defaults.embedding = "local-embed"

    calls = {"probe": 0, "discover": 0}

    def _collect_hosts(_settings, *, include_fallback: bool):  # noqa: ANN001, ARG001
        return {"http://localhost:11434"}

    def _probe_host(host: str, *, timeout: float):  # noqa: ARG001
        calls["probe"] += 1
        return True, None, 1

    def _auto_discover(_settings):  # noqa: ANN001
        calls["discover"] += 1
        return 0

    # Mock reason: validate lifespan scheduling and state updates without external Ollama dependency.
    monkeypatch.setattr(app_module, "collect_ollama_hosts", _collect_hosts)
    monkeypatch.setattr(app_module, "probe_ollama_host", _probe_host)
    monkeypatch.setattr(app_module, "auto_discover_ollama", _auto_discover)
    monkeypatch.setenv("CRYSTALITH_OPTIONAL_SERVICES_MONITOR_ENABLED", "1")
    monkeypatch.setenv("CRYSTALITH_OPTIONAL_SERVICES_MONITOR_INTERVAL_S", "0.02")
    monkeypatch.setenv("CRYSTALITH_OPTIONAL_SERVICES_MONITOR_TIMEOUT_S", "0.02")

    tempdir, db_url = await _create_test_db()
    manager = create_db_manager(db_url)
    app = create_app(settings=settings, db_manager=manager, vector_store=InMemoryVectorStore())

    try:
        async with app.router.lifespan_context(app):
            await asyncio.sleep(0.08)
            assert calls["probe"] >= 1
            assert calls["discover"] >= 1
            assert app.state.ollama_hosts_status["http://localhost:11434"]["healthy"] is True
            assert app.state.ollama_monitor_last_probe is not None
            assert app.state.optional_services_status["ollama"]["status"] == "healthy"
    finally:
        await manager.close()
        tempdir.cleanup()
