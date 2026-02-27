from __future__ import annotations

import asyncio
import datetime as dt
import logging
import os
import socket
from contextlib import asynccontextmanager, suppress
from pathlib import Path
from typing import Any
from urllib.parse import urlparse

import httpx
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
from crystalith.shared.config.ollama_discovery import (
    auto_discover_ollama,
    collect_ollama_hosts,
    probe_ollama_host,
)
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


def _env_float(name: str, default: float) -> float:
    value = os.getenv(name)
    if value is None:
        return default
    try:
        return float(value.strip())
    except ValueError:
        return default


def _iso_now() -> str:
    return dt.datetime.now(dt.timezone.utc).isoformat()


def _probe_http_endpoint(
    endpoint: str | None,
    *,
    timeout_s: float,
    path: str | None = None,
) -> tuple[bool, str | None]:
    if not endpoint:
        return False, "endpoint is empty"

    target = endpoint.rstrip("/")
    probe_path = (path or "").strip()
    if probe_path:
        if not probe_path.startswith("/"):
            probe_path = f"/{probe_path}"
        target = f"{target}{probe_path}"

    try:
        with httpx.Client(timeout=max(0.1, timeout_s), follow_redirects=True) as client:
            response = client.get(target)
        if response.status_code < 500:
            return True, None
        return False, f"HTTP {response.status_code}"
    except Exception as exc:  # noqa: BLE001 - endpoint-specific failures are expected
        return False, str(exc)


def _probe_redis_endpoint(
    endpoint: str | None,
    *,
    timeout_s: float,
) -> tuple[bool, str | None]:
    if not endpoint:
        return False, "endpoint is empty"

    parsed = urlparse(endpoint)
    host = parsed.hostname
    port = parsed.port or 6379
    if not host:
        return False, f"invalid endpoint: {endpoint}"

    try:
        with socket.create_connection((host, port), timeout=max(0.1, timeout_s)):
            return True, None
    except OSError as exc:
        return False, str(exc)


def _optional_recovery_hint(service_key: str) -> str:
    if service_key == "storage_chroma":
        return "启动 storage overlay，或设置 CHROMA_HOST/CHROMA_PORT 指向可用 Chroma 服务。"
    if service_key == "cache_redis":
        return "启动 redis overlay，或设置 REDIS_URL 指向可用 Redis。"
    if service_key == "ollama":
        return "启动 ollama overlay，或设置 OLLAMA_HOST 指向可用 Ollama。"
    return "检查服务地址与网络连通性，或禁用该可选服务。"


def _optional_error_code(service_key: str) -> str:
    if service_key == "storage_chroma":
        return "CHROMA_UNAVAILABLE"
    if service_key == "cache_redis":
        return "REDIS_UNAVAILABLE"
    if service_key == "ollama":
        return "OLLAMA_UNAVAILABLE"
    return "OPTIONAL_SERVICE_UNAVAILABLE"


def _model_provider(model: Any) -> str | None:
    if isinstance(model, dict):
        provider = model.get("provider")
        return str(provider) if provider is not None else None
    provider = getattr(model, "provider", None)
    return str(provider) if provider is not None else None


def _is_ollama_enabled(settings: Settings) -> bool:
    return (
        settings.optional_services.ollama.enabled
        or any(_model_provider(model) == "ollama" for model in settings.models.available)
        or bool(os.getenv("OLLAMA_HOST"))
    )


def _build_optional_status_template(settings: Settings) -> dict[str, dict[str, Any]]:
    vector_provider = settings.vector_storage.provider
    cache_provider = settings.cache.provider
    chroma_endpoint = settings.optional_services.chroma.endpoint or (
        f"http://{settings.vector_storage.chroma.host}:{settings.vector_storage.chroma.port}"
    )
    redis_endpoint = settings.optional_services.redis.endpoint or settings.cache.redis_url
    ollama_endpoint = os.getenv("OLLAMA_HOST") or settings.optional_services.ollama.endpoint
    searxng_endpoint = settings.optional_services.searxng.endpoint or settings.search.searxng.host

    return {
        "storage_chroma": {
            "service": "chroma",
            "enabled": settings.optional_services.chroma.enabled or vector_provider == "chroma",
            "provider": vector_provider,
            "endpoint": chroma_endpoint,
            "status": "unknown",
            "healthy": None,
            "error": None,
            "error_code": None,
            "recovery_hint": None,
            "last_probe": None,
            "probe": settings.optional_services.chroma.probe.model_dump(),
            "degrade_policy": settings.optional_services.chroma.degrade_policy,
        },
        "cache_redis": {
            "service": "redis",
            "enabled": settings.optional_services.redis.enabled or cache_provider == "redis",
            "provider": cache_provider,
            "endpoint": redis_endpoint,
            "status": "unknown",
            "healthy": None,
            "error": None,
            "error_code": None,
            "recovery_hint": None,
            "last_probe": None,
            "probe": settings.optional_services.redis.probe.model_dump(),
            "degrade_policy": settings.optional_services.redis.degrade_policy,
        },
        "ollama": {
            "service": "ollama",
            "enabled": _is_ollama_enabled(settings),
            "endpoint": ollama_endpoint,
            "status": "unknown",
            "healthy": None,
            "hosts": {},
            "error": None,
            "error_code": None,
            "recovery_hint": None,
            "last_probe": None,
            "probe": settings.optional_services.ollama.probe.model_dump(),
            "degrade_policy": settings.optional_services.ollama.degrade_policy,
        },
        "search_searxng": {
            "service": "searxng",
            "enabled": settings.optional_services.searxng.enabled or bool(searxng_endpoint),
            "endpoint": searxng_endpoint,
            "timeout_s": settings.search.searxng.timeout,
            "status": "unknown",
            "healthy": None,
            "error": None,
            "error_code": None,
            "recovery_hint": None,
            "last_probe": None,
            "probe": settings.optional_services.searxng.probe.model_dump(),
            "degrade_policy": settings.optional_services.searxng.degrade_policy,
        },
    }


def _finalize_optional_status(service_key: str, status: dict[str, Any]) -> None:
    if not status.get("enabled"):
        status["status"] = "disabled"
        status["healthy"] = None
        status["error"] = None
        status["error_code"] = None
        status["recovery_hint"] = None
        return

    healthy = status.get("healthy")
    if healthy is True:
        status["status"] = "healthy"
        status["error"] = None
        status["error_code"] = None
        status["recovery_hint"] = None
        return

    if healthy is False:
        status["status"] = "degraded"
        status["error_code"] = status.get("error_code") or _optional_error_code(service_key)
        status["recovery_hint"] = status.get("recovery_hint") or _optional_recovery_hint(service_key)
        return

    status["status"] = "unknown"
    status["error_code"] = None
    status["recovery_hint"] = None


async def _refresh_optional_services_status(
    app: FastAPIX,
    *,
    timeout_s: float,
    include_env_host: bool,
) -> None:
    settings: Settings = app.state.settings
    statuses = _build_optional_status_template(settings)
    probe_time = _iso_now()

    for service_key, status in statuses.items():
        probe_cfg = status.get("probe", {})
        probe_enabled = bool(probe_cfg.get("enabled", True))
        if not status.get("enabled") or not probe_enabled:
            _finalize_optional_status(service_key, status)
            continue

        service_timeout = max(0.1, float(probe_cfg.get("timeout_s", timeout_s)))
        service_path = probe_cfg.get("path")
        status["last_probe"] = probe_time

        if service_key == "storage_chroma":
            healthy, error = await asyncio.to_thread(
                _probe_http_endpoint,
                status.get("endpoint"),
                timeout_s=service_timeout,
                path=service_path or "/api/v1/heartbeat",
            )
            status["healthy"] = healthy
            status["error"] = error

        elif service_key == "cache_redis":
            healthy, error = await asyncio.to_thread(
                _probe_redis_endpoint,
                status.get("endpoint"),
                timeout_s=service_timeout,
            )
            status["healthy"] = healthy
            status["error"] = error

        elif service_key == "ollama":
            hosts = collect_ollama_hosts(
                settings,
                include_env=include_env_host,
                include_fallback=True,
            )
            endpoint = status.get("endpoint")
            if isinstance(endpoint, str) and endpoint.strip():
                hosts.add(endpoint.strip())

            host_status: dict[str, dict[str, Any]] = {}
            has_healthy_host = False
            for host in sorted(hosts):
                healthy, error_message, model_count = await asyncio.to_thread(
                    probe_ollama_host,
                    host,
                    timeout=service_timeout,
                )
                host_status[host] = {
                    "healthy": healthy,
                    "error": error_message,
                    "model_count": model_count,
                }
                has_healthy_host = has_healthy_host or healthy

            status["hosts"] = host_status
            status["healthy"] = has_healthy_host if host_status else None
            if not has_healthy_host and host_status:
                first_error = next((item.get("error") for item in host_status.values() if item.get("error")), None)
                status["error"] = first_error or "all ollama probes failed"

            app.state.ollama_hosts_status = host_status
            app.state.ollama_monitor_last_probe = probe_time

            if has_healthy_host:
                added = await asyncio.to_thread(auto_discover_ollama, settings)
                if added:
                    logger.info("Ollama monitor discovered %d new models", added)

        elif service_key == "search_searxng":
            healthy, error = await asyncio.to_thread(
                _probe_http_endpoint,
                status.get("endpoint"),
                timeout_s=service_timeout,
                path=service_path,
            )
            status["healthy"] = healthy
            status["error"] = error

        _finalize_optional_status(service_key, status)

    app.state.optional_services_status = statuses
    app.state.optional_services_last_probe = probe_time


def _optional_services_snapshot(app: FastAPIX) -> dict[str, dict[str, Any]]:
    settings: Settings = app.state.settings
    snapshot = _build_optional_status_template(settings)
    current = dict(getattr(app.state, "optional_services_status", {}) or {})
    static_fields = {"enabled", "endpoint", "provider", "probe", "degrade_policy", "timeout_s"}
    for service_key, service_status in current.items():
        if service_key in snapshot and isinstance(service_status, dict):
            for field, value in service_status.items():
                if field in static_fields:
                    continue
                snapshot[service_key][field] = value

    legacy_ollama_hosts = dict(getattr(app.state, "ollama_hosts_status", {}) or {})
    if legacy_ollama_hosts:
        ollama = snapshot["ollama"]
        if not ollama.get("hosts"):
            ollama["hosts"] = legacy_ollama_hosts
        if ollama.get("healthy") is None:
            ollama["healthy"] = any(bool(item.get("healthy")) for item in legacy_ollama_hosts.values())
        if ollama.get("last_probe") is None:
            ollama["last_probe"] = getattr(app.state, "ollama_monitor_last_probe", None)

    for service_key, status in snapshot.items():
        _finalize_optional_status(service_key, status)

    return snapshot


async def _run_optional_services_monitor(
    app: FastAPIX,
    stop_event: asyncio.Event,
    *,
    interval_s: float,
    timeout_s: float,
    include_env_host: bool,
) -> None:
    while not stop_event.is_set():
        try:
            await _refresh_optional_services_status(
                app,
                timeout_s=timeout_s,
                include_env_host=include_env_host,
            )
        except Exception:  # noqa: BLE001 - best-effort background probe
            logger.exception("Optional services monitor probe failed")

        try:
            await asyncio.wait_for(stop_event.wait(), timeout=interval_s)
        except asyncio.TimeoutError:
            continue


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
        optional_monitor_stop: asyncio.Event | None = None
        optional_monitor_task: asyncio.Task[None] | None = None

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

        app.state.ollama_hosts_status = {}
        app.state.ollama_monitor_last_probe = None
        app.state.optional_services_status = _build_optional_status_template(app.state.settings)
        app.state.optional_services_last_probe = None

        if _env_bool("CRYSTALITH_OPTIONAL_SERVICES_MONITOR_ENABLED", True):
            interval_s = max(0.1, _env_float("CRYSTALITH_OPTIONAL_SERVICES_MONITOR_INTERVAL_S", 15.0))
            timeout_s = max(0.1, _env_float("CRYSTALITH_OPTIONAL_SERVICES_MONITOR_TIMEOUT_S", 3.0))
            include_env_host = _env_bool("CRYSTALITH_OPTIONAL_SERVICES_MONITOR_INCLUDE_ENV_HOST", True)
            optional_monitor_stop = asyncio.Event()
            optional_monitor_task = asyncio.create_task(
                _run_optional_services_monitor(
                    app,
                    optional_monitor_stop,
                    interval_s=interval_s,
                    timeout_s=timeout_s,
                    include_env_host=include_env_host,
                )
            )

        await app.state.task_queue.start_worker()
        try:
            yield
        finally:
            if optional_monitor_stop is not None:
                optional_monitor_stop.set()
            if optional_monitor_task is not None:
                try:
                    await asyncio.wait_for(optional_monitor_task, timeout=2.0)
                except asyncio.TimeoutError:
                    optional_monitor_task.cancel()
                    with suppress(asyncio.CancelledError):
                        await optional_monitor_task
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
    app.state.optional_services_status = _build_optional_status_template(resolved)
    app.state.optional_services_last_probe = None
    app.state.ollama_hosts_status = {}
    app.state.ollama_monitor_last_probe = None

    @app.get("/health", include_in_schema=False)
    async def health() -> dict[str, str]:
        return {"status": "ok"}

    @app.get("/health/dependencies", include_in_schema=False)
    async def dependency_health() -> dict[str, Any]:
        has_legacy_ollama_state = bool(getattr(app.state, "ollama_hosts_status", {}) or {})
        if getattr(app.state, "optional_services_last_probe", None) is None and not has_legacy_ollama_state:
            try:
                await _refresh_optional_services_status(
                    app,
                    timeout_s=1.0,
                    include_env_host=True,
                )
            except Exception:  # noqa: BLE001 - keep dependency health non-blocking
                logger.exception("Dependency health probe refresh failed")

        optional_status = _optional_services_snapshot(app)

        return {
            "status": "ok",
            "generated_at": _iso_now(),
            "last_probe": getattr(app.state, "optional_services_last_probe", None),
            "core": {
                "frontend": {
                    "service": "web",
                    "healthy": None,
                    "note": "frontend health is validated through reverse-proxy route /health",
                },
                "backend": {"service": "api", "healthy": True},
            },
            "optional": optional_status,
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
