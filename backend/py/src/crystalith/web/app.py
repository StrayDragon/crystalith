from __future__ import annotations

import asyncio
import logging
import os
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Any

from fastapi import HTTPException, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse, JSONResponse, Response
from scalar_fastapi import get_scalar_api_reference
from sqlalchemy import delete, select, text

from cl_fastapix import FastAPIX
from cl_sqlalchemyx.mgrs import AsyncDBManager

from crystalith.shared.ai.openai_client_manager import get_openai_client_manager
from crystalith.shared.cache import CacheProvider, create_cache_provider
from crystalith.shared.concurrency import StageLimiters
from crystalith.shared.config import ConfigManager, Settings
from crystalith.shared.db import Source, create_db_manager
from crystalith.shared.db.migrations import upgrade_head
from crystalith.shared.schemas.errors import (
    build_error_response,
    build_error_response_from_exception,
    status_code_from_exception,
)
from crystalith.shared.plugins import PluginRegistry
from crystalith.shared.types import SourceStatus
from crystalith.shared.vector_storage import VectorStore, create_vector_store

from crystalith.features.tasks.queue import TaskQueue

from .routers import register_routers

logger = logging.getLogger(__name__)


def _find_config_path() -> Path | None:
    cwd = Path.cwd()
    for parent in (cwd, *cwd.parents):
        candidate = parent / "config/app.yaml"
        if candidate.is_file():
            return candidate
    return None


def _load_settings() -> Settings:
    config_path_value = os.environ.get("CRYSTALITH_CONFIG_PATH")
    if config_path_value:
        config_path = Path(config_path_value)
        if not config_path.is_file():
            raise FileNotFoundError(f"Config file not found: {config_path}")
    else:
        config_dir_value = os.environ.get("CRYSTALITH_CONFIG_DIR")
        if config_dir_value:
            config_path = Path(config_dir_value) / "app.yaml"
            if not config_path.is_file():
                raise FileNotFoundError(f"Config file not found: {config_path}")
        else:
            config_path = _find_config_path()

    if config_path is not None:
        schema_path = config_path.parent / "app.schema.json"
        secrets_path_value = os.environ.get("CRYSTALITH_SECRETS_PATH")
        secrets_path = Path(secrets_path_value) if secrets_path_value else None
        manager = ConfigManager(config_path, schema_path, secrets_path=secrets_path)
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


def _env_bool(name: str, default: bool = False) -> bool:
    value = os.getenv(name)
    if value is None:
        return default
    return value.strip().lower() not in {"0", "false", "no", "off"}


def _env_bool_optional(name: str) -> bool | None:
    value = os.getenv(name)
    if value is None:
        return None
    return value.strip().lower() not in {"0", "false", "no", "off"}


def create_app(
    settings: Settings | None = None,
    *,
    db_manager: AsyncDBManager | None = None,
    vector_store: VectorStore | None = None,
    task_queue: TaskQueue | None = None,
    cache_provider: CacheProvider | None = None,
) -> FastAPIX:
    resolved = settings or _load_settings()
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
        if _env_bool("AUTO_DB_INIT", False):
            await asyncio.to_thread(upgrade_head, app.state.settings.database.url)

        try:
            report = app.state.plugins.load_from_entry_points(app.state.settings)
            logger.info(
                "Loaded plugins on startup",
                extra={"loaded": report.loaded, "skipped": report.skipped},
            )
        except Exception:  # noqa: BLE001 - plugin boundary
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
            except Exception:  # noqa: BLE001
                logger.exception("Failed to initialize built-in templates")

        cleanup_failed_sources = _env_bool_optional("AUTO_CLEANUP_FAILED_SOURCES")
        if cleanup_failed_sources is None:
            cleanup_failed_sources = app.state.settings.app.startup.cleanup_failed_sources

        if cleanup_failed_sources:
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
            close_vector_store = getattr(app.state.vector_store, "close", None)
            if close_vector_store is not None:
                await close_vector_store()
            cache_provider_instance = getattr(app.state, "cache", None)
            close_cache = getattr(cache_provider_instance, "close", None) if cache_provider_instance else None
            if close_cache is not None:
                await close_cache()
            stop_worker = getattr(app.state.task_queue, "stop_worker", None)
            if stop_worker is not None:
                await stop_worker()
            try:
                await get_openai_client_manager().aclose()
            except Exception:  # noqa: BLE001 - best-effort shutdown
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

    @app.get("/health", include_in_schema=False)
    async def health() -> dict[str, str]:
        return {"status": "ok"}

    cors = resolved.app.cors
    if cors.allow_origins:
        app.add_middleware(
            CORSMiddleware,
            allow_origins=cors.allow_origins,
            allow_credentials=cors.allow_credentials,
            allow_methods=cors.allow_methods,
            allow_headers=cors.allow_headers,
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
        rendered: Any = get_scalar_api_reference(
            openapi_url=resolved.app.openapi_path,
            title=resolved.app.name,
        )
        if isinstance(rendered, Response):
            return rendered
        return HTMLResponse(rendered)

    register_routers(app)
    return app
