from __future__ import annotations

import asyncio
import datetime as dt
import ipaddress
import logging
import os
from contextlib import asynccontextmanager
from pathlib import Path
from fastapi import HTTPException, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse, JSONResponse, Response
from lush_fastapix import FastAPIX
from lush_sqlalchemyx.mgrs import AsyncMySQLManager
from scalar_fastapi import get_scalar_api_reference
from sqlalchemy import delete, select, text

from crystalith.features.tasks.queue import TaskQueue
from crystalith.shared.ai.openai_client_manager import get_openai_client_manager
from crystalith.shared.cache import CacheProvider, create_cache_provider
from crystalith.shared.concurrency import StageLimiters
from crystalith.shared.config import ConfigManager, Settings
from crystalith.shared.db import Source, create_db_manager
from crystalith.shared.db.migrations import upgrade_head
from crystalith.shared.env import (
    CRYSTALITH_CONFIG_DIR,
    CRYSTALITH_CONFIG_PATH,
)
from crystalith.shared.plugins import PluginRegistry
from crystalith.shared.plugins.registry import EntryPointsProvider
from crystalith.shared.schemas.errors import (
    build_error_response,
    build_error_response_from_exception,
    status_code_from_exception,
)
from crystalith.shared.types import SourceStatus
from crystalith.shared.vector_storage import VectorStore, create_vector_store

from .routers import register_routers

logger = logging.getLogger(__name__)

_DEFAULT_LISTEN_HOST = "127.0.0.1"


def _is_loopback_listen_host(host: str | None) -> bool:
    if host is None:
        return True

    text = host.strip()
    if not text:
        return True

    lowered = text.lower()
    if lowered == "localhost":
        return True

    if lowered.startswith("[") and lowered.endswith("]"):
        lowered = lowered[1:-1]

    try:
        ip = ipaddress.ip_address(lowered)
    except ValueError:
        return False

    return ip.is_loopback


def _resolve_http_guardrails_enabled(settings: Settings, *, listen_host: str | None) -> bool:
    mode = settings.app.http_guardrails.mode
    if mode == "enabled":
        return True
    if mode == "disabled":
        return False
    return not _is_loopback_listen_host(listen_host)


def _find_config_path() -> Path | None:
    cwd = Path.cwd()
    for parent in (cwd, *cwd.parents):
        candidate = parent / "config/app.yaml"
        if candidate.is_file():
            return candidate
    return None


def _discover_overlay_paths(config_path: Path) -> list[Path]:
    """
    Auto-discover overlay config files to merge on top of the base config.

    Discovery order (all existing files are merged in this order):
      1. app.local.yaml   — user-local overrides (gitignored)
      2. app.{env}.yaml   — environment-specific (CRYSTALITH_ENV, e.g. "dev", "staging")
      3. app.{env}.local.yaml — environment + local overrides

    All paths are relative to the base config's parent directory.
    """
    config_dir = config_path.parent
    overlays: list[Path] = []

    def _append_unique(path: Path) -> None:
        if path.is_file() and path not in overlays:
            overlays.append(path)

    _append_unique(config_dir / "app.local.yaml")

    env_name = os.environ.get("CRYSTALITH_ENV", "").strip().lower()
    if env_name:
        _append_unique(config_dir / f"app.{env_name}.yaml")
        _append_unique(config_dir / f"app.{env_name}.local.yaml")

    return overlays


def _load_settings() -> Settings:
    config_path_value = os.environ.get(CRYSTALITH_CONFIG_PATH)
    if config_path_value:
        config_path = Path(config_path_value)
        if not config_path.is_file():
            raise FileNotFoundError(f"Config file not found: {config_path}")
    else:
        config_dir_value = os.environ.get(CRYSTALITH_CONFIG_DIR)
        if config_dir_value:
            config_path = Path(config_dir_value) / "app.yaml"
            if not config_path.is_file():
                raise FileNotFoundError(f"Config file not found: {config_path}")
        else:
            config_path = _find_config_path()

    if config_path is not None:
        schema_path = config_path.parent / "app.schema.gen.json"
        overlay_paths = _discover_overlay_paths(config_path)
        if overlay_paths:
            logger.info(
                "Config overlay files discovered: %s",
                [str(p.name) for p in overlay_paths],
            )
        manager = ConfigManager(
            config_path, schema_path,
            overlay_paths=overlay_paths,
        )
        if not schema_path.exists():
            manager.write_schema()
        return manager.load()
    fallback_path = Path("config/app.yaml")
    logger.warning(
        "Config file not found at %s (cwd=%s). Using default settings.",
        fallback_path.resolve(),
        Path.cwd(),
    )
    return Settings()


def _iso_now() -> str:
    return dt.datetime.now(dt.UTC).isoformat()


def create_app(
    settings: Settings | None = None,
    *,
    db_manager: AsyncMySQLManager | None = None,
    vector_store: VectorStore | None = None,
    task_queue: TaskQueue | None = None,
    cache_provider: CacheProvider | None = None,
    plugins_entry_points_provider: EntryPointsProvider | None = None,
) -> FastAPIX:
    resolved = settings or _load_settings()
    listen_host = os.getenv("HOST") or _DEFAULT_LISTEN_HOST
    http_guardrails_enabled = _resolve_http_guardrails_enabled(resolved, listen_host=listen_host)

    db = db_manager or create_db_manager(resolved.database.url)
    store = vector_store if vector_store is not None else create_vector_store(resolved)
    cache = cache_provider or create_cache_provider(resolved)
    limiters = StageLimiters.from_limits(
        embedding=resolved.concurrency.embedding,
        vector_search=resolved.concurrency.vector_search,
        llm_generate=resolved.concurrency.llm_generate,
    )
    plugins = PluginRegistry()
    queue = task_queue or TaskQueue(
        db_manager=db,
        settings=resolved,
        vector_store=store,
        plugins=plugins,
        limiters=limiters,
    )

    @asynccontextmanager
    async def lifespan(app: FastAPIX):
        if app.state.settings.app.startup.auto_db_init:
            await asyncio.to_thread(upgrade_head, app.state.settings.database.url)

        try:
            report = app.state.plugins.load_from_entry_points(
                app.state.settings,
                entry_points_provider=plugins_entry_points_provider,
            )
            logger.info(
                "Loaded plugins on startup",
                extra={"loaded": report.loaded, "skipped": report.skipped},
            )
        except Exception:
            logger.exception("Failed to load plugins")

        async with app.state.db.got_manual_session() as session:
            try:
                if app.state.db.async_engine.dialect.name == "sqlite":
                    await session.execute(
                        text("UPDATE sources SET status = lower(status) WHERE status != lower(status)")
                    )
                    await session.commit()

                from crystalith.features.templates.service import ensure_builtin_templates

                await ensure_builtin_templates(session)
            except Exception:
                logger.exception("Failed to initialize built-in templates")

        if app.state.settings.app.startup.cleanup_failed_sources:
            async with app.state.db.got_manual_session() as session:
                failed_sources = await session.execute(
                    select(Source).where(Source.status == SourceStatus.FAILED)
                )
                failed_list = list(failed_sources.scalars().all())
                if failed_list:
                    source_ids = [s.id for s in failed_list]
                    await session.execute(delete(Source).where(Source.id.in_(source_ids)))
                    await session.commit()
                    logger.info(
                        "Cleaned up %d failed sources on startup: %s",
                        len(source_ids),
                        source_ids,
                    )

        await app.state.task_queue.start_worker()
        try:
            yield
        finally:
            await app.state.db.close()
            await app.state.vector_store.close()
            await app.state.cache.close()
            await app.state.task_queue.stop_worker()
            try:
                await get_openai_client_manager().aclose()
            except Exception:
                logger.exception("Failed to close OpenAI clients")

    app = FastAPIX(
        title=resolved.app.name,
        openapi_url=resolved.app.openapi_path,
        docs_url=None,
        redoc_url=None,
        lifespan=lifespan,
    )

    app.state.settings = resolved
    app.state.db = db
    app.state.vector_store = store
    app.state.cache = cache
    app.state.limiters = limiters
    app.state.task_queue = queue
    app.state.plugins = plugins
    app.state.embedding_provider = None
    app.state.ai_provider = None
    app.state.listen_host = listen_host
    app.state.http_guardrails_enabled = http_guardrails_enabled

    @app.get("/health", include_in_schema=False)
    async def health() -> dict[str, str]:
        return {"status": "ok"}

    @app.get("/health/dependencies", include_in_schema=False)
    async def dependency_health() -> dict[str, object]:
        return {
            "status": "ok",
            "generated_at": _iso_now(),
            "core": {
                "frontend": {
                    "service": "web",
                    "healthy": None,
                    "note": "frontend health is validated through reverse-proxy route /health",
                },
                "backend": {"service": "api", "healthy": True},
            },
        }

    cors = resolved.app.cors
    if cors.allow_origins:
        app.add_middleware(
            CORSMiddleware,
            allow_origins=cors.allow_origins,
            allow_credentials=cors.allow_credentials,
            allow_methods=cors.allow_methods,
            allow_headers=cors.allow_headers,
        )

    if http_guardrails_enabled:
        rate_limit = resolved.app.http_guardrails.rate_limit
        if rate_limit.enabled and rate_limit.max_requests > 0:
            from crystalith.web.http_rate_limit import HttpRateLimitMiddleware

            app.add_middleware(
                HttpRateLimitMiddleware,
                window_s=rate_limit.window_s,
                max_requests=rate_limit.max_requests,
                enabled=True,
            )

    @app.exception_handler(HTTPException)
    async def handle_http_exception(_: Request, exc: HTTPException) -> JSONResponse:
        payload = build_error_response(
            status_code=exc.status_code,
            detail=exc.detail,
            headers=exc.headers,
        )
        headers = dict(exc.headers or {})
        if payload.retry_after is not None and "Retry-After" not in headers:
            headers["Retry-After"] = str(payload.retry_after)
        return JSONResponse(
            status_code=exc.status_code,
            content=payload.model_dump(exclude_none=True),
            headers=headers or None,
        )

    @app.exception_handler(RequestValidationError)
    async def handle_validation_exception(_: Request, exc: RequestValidationError) -> JSONResponse:
        payload = build_error_response(
            status_code=422,
            detail={
                "error_code": "VALIDATION_ERROR",
                "message": "请求参数验证失败",
                "details": exc.errors(),
            },
        )
        return JSONResponse(
            status_code=422,
            content=payload.model_dump(exclude_none=True),
        )

    @app.exception_handler(Exception)
    async def handle_unexpected_exception(_: Request, exc: Exception) -> JSONResponse:
        resolved_status = status_code_from_exception(exc) or 500
        payload = build_error_response_from_exception(exc, status_code=resolved_status)
        headers: dict[str, str] = {}
        if payload.retry_after is not None:
            headers["Retry-After"] = str(payload.retry_after)
        logger.exception("Unhandled exception during request", exc_info=exc)
        return JSONResponse(
            status_code=resolved_status,
            content=payload.model_dump(exclude_none=True),
            headers=headers or None,
        )

    @app.get(resolved.app.openapi_ui_path, include_in_schema=False)
    def scalar_docs() -> Response:
        rendered = get_scalar_api_reference(
            openapi_url=resolved.app.openapi_path,
            title=resolved.app.name,
        )
        if isinstance(rendered, Response):
            return rendered
        return HTMLResponse(rendered)

    register_routers(app)
    return app
