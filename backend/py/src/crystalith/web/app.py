from __future__ import annotations

import asyncio
import datetime as dt
import logging
import os
import socket
from collections.abc import Awaitable
from contextlib import asynccontextmanager, suppress
from pathlib import Path
from typing import Protocol
from urllib.parse import urlparse

import httpx
from cl_fastapix import FastAPIX
from cl_sqlalchemyx.mgrs import AsyncDBManager
from fastapi import HTTPException, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse, JSONResponse, Response
from scalar_fastapi import get_scalar_api_reference
from sqlalchemy import delete, select, text

from crystalith.features.tasks.queue import TaskQueue
from crystalith.shared.ai.openai_client_manager import get_openai_client_manager
from crystalith.shared.cache import CacheProvider, create_cache_provider
from crystalith.shared.concurrency import StageLimiters
from crystalith.shared.config import ConfigManager, ModelConfig, Settings
from crystalith.shared.config.endpoint_candidates import order_endpoint_candidates
from crystalith.shared.config.ollama_discovery import (
    auto_discover_ollama,
    collect_ollama_hosts,
    probe_ollama_host,
)
from crystalith.shared.db import Source, create_db_manager
from crystalith.shared.db.migrations import upgrade_head
from crystalith.shared.env import (
    CRYSTALITH_CONFIG_DIR,
    CRYSTALITH_CONFIG_PATH,
    CRYSTALITH_OPTIONAL_SERVICES_MONITOR_ENABLED,
    CRYSTALITH_OPTIONAL_SERVICES_MONITOR_INTERVAL_S,
    CRYSTALITH_OPTIONAL_SERVICES_MONITOR_TIMEOUT_S,
    CRYSTALITH_SECRETS_PATH,
    OPTIONAL_SERVICES_MONITOR_ENABLED_DEFAULT,
    OPTIONAL_SERVICES_MONITOR_INTERVAL_S_DEFAULT,
    OPTIONAL_SERVICES_MONITOR_TIMEOUT_S_DEFAULT,
    env_bool,
    env_float,
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

from .optional_services_types import (
    OllamaHostStatus,
    OptionalServicesStatus,
    OptionalServiceStatus,
    ServiceKey,
)
from .routers import register_routers

logger = logging.getLogger(__name__)


class HttpEndpointProber(Protocol):
    def __call__(
        self,
        endpoint: str | None,
        *,
        timeout_s: float,
        path: str | None = None,
        healthy_status_codes: set[int] | None = None,
    ) -> tuple[bool, str | None]: ...


class OptionalServicesRefresher(Protocol):
    def __call__(self, app: FastAPIX, *, timeout_s: float) -> Awaitable[None]: ...


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
        secrets_path_value = os.environ.get(CRYSTALITH_SECRETS_PATH)
        secrets_path = Path(secrets_path_value) if secrets_path_value else None
        overlay_paths = _discover_overlay_paths(config_path)
        if overlay_paths:
            logger.info(
                "Config overlay files discovered: %s",
                [str(p.name) for p in overlay_paths],
            )
        manager = ConfigManager(
            config_path, schema_path,
            secrets_path=secrets_path,
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


def _probe_http_endpoint(
    endpoint: str | None,
    *,
    timeout_s: float,
    path: str | None = None,
    healthy_status_codes: set[int] | None = None,
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
        with httpx.Client(timeout=max(0.1, timeout_s), follow_redirects=True) as client, client.stream("GET", target) as response:
            status_code = response.status_code
        accepted_status_codes = set(healthy_status_codes or set())
        if 200 <= status_code < 300 or status_code in accepted_status_codes:
            return True, None
        return False, f"HTTP {status_code}"
    except Exception as exc:
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


def _optional_recovery_hint(service_key: ServiceKey) -> str:
    if service_key == "storage_chroma":
        return "启动 storage overlay，或在 config/app.yaml 配置 Chroma 端点（vector_storage.chroma.*）。"
    if service_key == "cache_redis":
        return "启动 redis overlay，或在 config/app.yaml 配置 cache.provider/redis_url_candidates。"
    if service_key == "ollama":
        return "启动 ollama overlay，或在 config/app.yaml 配置 optional_services.ollama.endpoint_candidates。"
    return "检查服务地址与网络连通性，或禁用该可选服务。"


def _optional_error_code(service_key: ServiceKey) -> str:
    if service_key == "storage_chroma":
        return "CHROMA_UNAVAILABLE"
    if service_key == "cache_redis":
        return "REDIS_UNAVAILABLE"
    if service_key == "ollama":
        return "OLLAMA_UNAVAILABLE"
    return "OPTIONAL_SERVICE_UNAVAILABLE"


def _model_provider(model: ModelConfig) -> str:
    return model.provider


def _is_ollama_enabled(settings: Settings) -> bool:
    if settings.optional_services.ollama.enabled or bool(settings.optional_services.ollama.endpoint_candidates):
        return True

    default_chat = settings.get_default_chat_model()
    default_embed = settings.get_default_embedding_model()
    return bool(
        (default_chat and _model_provider(default_chat) == "ollama")
        or (default_embed and _model_provider(default_embed) == "ollama")
    )


def _build_optional_status_template(settings: Settings) -> OptionalServicesStatus:
    vector_provider = settings.vector_storage.provider
    cache_provider = settings.cache.provider
    chroma_host = settings.vector_storage.chroma.host
    chroma_host_set = bool(chroma_host and chroma_host.strip())
    chroma_enabled = settings.optional_services.chroma.enabled or (vector_provider == "chroma" and chroma_host_set)
    chroma_endpoint = None
    if chroma_enabled:
        chroma_endpoint = (
            f"http://{chroma_host}:{settings.vector_storage.chroma.port}"
            if chroma_host_set
            else settings.optional_services.chroma.endpoint
        )
    redis_endpoint = settings.cache.redis_url
    if not (redis_endpoint and redis_endpoint.strip()):
        redis_candidates = []
        redis_candidates.extend(settings.cache.redis_url_candidates)
        redis_candidates.extend(settings.optional_services.redis.endpoint_candidates)
        if settings.optional_services.redis.endpoint:
            redis_candidates.append(settings.optional_services.redis.endpoint)
        redis_endpoint = order_endpoint_candidates(redis_candidates)[0] if redis_candidates else None

    ollama_endpoint = settings.optional_services.ollama.endpoint
    searxng_host = settings.search.searxng.host
    searxng_host_set = bool(searxng_host and searxng_host.strip())
    searxng_enabled = bool(
        settings.optional_services.searxng.enabled
        or searxng_host_set
        or settings.search.searxng.endpoint_candidates
        or settings.optional_services.searxng.endpoint_candidates
    )
    searxng_endpoint = None
    if searxng_enabled:
        if searxng_host_set:
            searxng_endpoint = searxng_host.strip()
        else:
            searxng_candidates = []
            searxng_candidates.extend(settings.search.searxng.endpoint_candidates)
            searxng_candidates.extend(settings.optional_services.searxng.endpoint_candidates)
            if settings.optional_services.searxng.endpoint:
                searxng_candidates.append(settings.optional_services.searxng.endpoint)
            searxng_endpoint = order_endpoint_candidates(searxng_candidates)[0] if searxng_candidates else None

    chroma_probe = settings.optional_services.chroma.probe
    redis_probe = settings.optional_services.redis.probe
    ollama_probe = settings.optional_services.ollama.probe
    searxng_probe = settings.optional_services.searxng.probe

    return {
        "storage_chroma": {
            "service": "chroma",
            "enabled": chroma_enabled,
            "provider": vector_provider,
            "endpoint": chroma_endpoint,
            "status": "unknown",
            "healthy": None,
            "error": None,
            "error_code": None,
            "recovery_hint": None,
            "last_probe": None,
            "probe": {
                "enabled": bool(chroma_probe.enabled),
                "timeout_s": float(chroma_probe.timeout_s),
                "interval_s": float(chroma_probe.interval_s),
                "path": chroma_probe.path,
            },
            "degrade_policy": settings.optional_services.chroma.degrade_policy,
        },
        "cache_redis": {
            "service": "redis",
            "enabled": bool(
                settings.optional_services.redis.enabled
                or cache_provider in {"redis", "auto"}
                or settings.cache.redis_url_candidates
                or settings.optional_services.redis.endpoint_candidates
            ),
            "provider": cache_provider,
            "endpoint": redis_endpoint,
            "status": "unknown",
            "healthy": None,
            "error": None,
            "error_code": None,
            "recovery_hint": None,
            "last_probe": None,
            "probe": {
                "enabled": bool(redis_probe.enabled),
                "timeout_s": float(redis_probe.timeout_s),
                "interval_s": float(redis_probe.interval_s),
                "path": redis_probe.path,
            },
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
            "probe": {
                "enabled": bool(ollama_probe.enabled),
                "timeout_s": float(ollama_probe.timeout_s),
                "interval_s": float(ollama_probe.interval_s),
                "path": ollama_probe.path,
            },
            "degrade_policy": settings.optional_services.ollama.degrade_policy,
        },
        "search_searxng": {
            "service": "searxng",
            "enabled": searxng_enabled,
            "endpoint": searxng_endpoint,
            "timeout_s": settings.search.searxng.timeout,
            "status": "unknown",
            "healthy": None,
            "error": None,
            "error_code": None,
            "recovery_hint": None,
            "last_probe": None,
            "probe": {
                "enabled": bool(searxng_probe.enabled),
                "timeout_s": float(searxng_probe.timeout_s),
                "interval_s": float(searxng_probe.interval_s),
                "path": searxng_probe.path,
            },
            "degrade_policy": settings.optional_services.searxng.degrade_policy,
        },
    }


def _finalize_optional_status(service_key: ServiceKey, status: OptionalServiceStatus) -> None:
    if not status["enabled"]:
        status["status"] = "disabled"
        status["healthy"] = None
        status["error"] = None
        status["error_code"] = None
        status["recovery_hint"] = None
        return

    healthy = status["healthy"]
    if healthy is True:
        status["status"] = "healthy"
        status["error"] = None
        status["error_code"] = None
        status["recovery_hint"] = None
        return

    if healthy is False:
        status["status"] = "degraded"
        status["error_code"] = status["error_code"] or _optional_error_code(service_key)
        status["recovery_hint"] = status["recovery_hint"] or _optional_recovery_hint(service_key)
        return

    status["status"] = "unknown"
    status["error_code"] = None
    status["recovery_hint"] = None


async def _refresh_optional_services_status(
    app: FastAPIX,
    *,
    timeout_s: float,
    http_endpoint_prober: HttpEndpointProber = _probe_http_endpoint,
) -> None:
    settings: Settings = app.state.settings
    statuses = _build_optional_status_template(settings)
    probe_time = _iso_now()

    chroma = statuses["storage_chroma"]
    chroma_probe = chroma["probe"]
    if chroma["enabled"] and chroma_probe["enabled"]:
        service_timeout = max(0.1, float(chroma_probe["timeout_s"] or timeout_s))
        service_path = chroma_probe["path"]
        chroma["last_probe"] = probe_time
        healthy, error = await asyncio.to_thread(
            http_endpoint_prober,
            chroma["endpoint"],
            timeout_s=service_timeout,
            path=service_path or "/api/v1/heartbeat",
        )
        chroma["healthy"] = healthy
        chroma["error"] = error
    _finalize_optional_status("storage_chroma", chroma)

    redis = statuses["cache_redis"]
    redis_probe = redis["probe"]
    if redis["enabled"] and redis_probe["enabled"]:
        service_timeout = max(0.1, float(redis_probe["timeout_s"] or timeout_s))
        redis["last_probe"] = probe_time
        redis_candidates = []
        if settings.cache.redis_url:
            redis_candidates.append(settings.cache.redis_url)
        redis_candidates.extend(settings.cache.redis_url_candidates)
        redis_candidates.extend(settings.optional_services.redis.endpoint_candidates)
        if settings.optional_services.redis.endpoint:
            redis_candidates.append(settings.optional_services.redis.endpoint)
        ordered = order_endpoint_candidates(redis_candidates)
        if not ordered:
            redis["healthy"] = False
            redis["error"] = "endpoint is empty"
        else:
            redis_last_error: str | None = None
            for candidate in ordered:
                healthy, error = await asyncio.to_thread(
                    _probe_redis_endpoint,
                    candidate,
                    timeout_s=service_timeout,
                )
                if healthy:
                    redis["endpoint"] = candidate
                    redis["healthy"] = True
                    redis["error"] = None
                    break
                redis_last_error = error
            else:
                redis["endpoint"] = ordered[0]
                redis["healthy"] = False
                redis["error"] = redis_last_error or "probe failed"
    _finalize_optional_status("cache_redis", redis)

    ollama = statuses["ollama"]
    ollama_probe = ollama["probe"]
    if ollama["enabled"] and ollama_probe["enabled"]:
        service_timeout = max(0.1, float(ollama_probe["timeout_s"] or timeout_s))
        ollama["last_probe"] = probe_time
        hosts = collect_ollama_hosts(
            settings,
            include_fallback=True,
        )
        endpoint = ollama["endpoint"]
        if endpoint is not None and endpoint.strip():
            hosts.add(endpoint.strip())

        host_status: dict[str, OllamaHostStatus] = {}
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

        ollama["hosts"] = host_status
        ollama["healthy"] = has_healthy_host if host_status else None
        if not has_healthy_host and host_status:
            first_error = next((item["error"] for item in host_status.values() if item["error"]), None)
            ollama["error"] = first_error or "all ollama probes failed"

        app.state.ollama_hosts_status = host_status
        app.state.ollama_monitor_last_probe = probe_time

        if has_healthy_host:
            added = await asyncio.to_thread(auto_discover_ollama, settings)
            if added:
                logger.info("Ollama monitor discovered %d new models", added)
    _finalize_optional_status("ollama", ollama)

    searxng = statuses["search_searxng"]
    searxng_probe = searxng["probe"]
    if searxng["enabled"] and searxng_probe["enabled"]:
        service_timeout = max(0.1, float(searxng["timeout_s"] or timeout_s))
        service_path = searxng_probe["path"]
        searxng["last_probe"] = probe_time
        searxng_host = (settings.search.searxng.host or "").strip()
        if searxng_host:
            ordered = [searxng_host]
        else:
            searxng_candidates = []
            searxng_candidates.extend(settings.search.searxng.endpoint_candidates)
            searxng_candidates.extend(settings.optional_services.searxng.endpoint_candidates)
            if settings.optional_services.searxng.endpoint:
                searxng_candidates.append(settings.optional_services.searxng.endpoint)
            ordered = order_endpoint_candidates(searxng_candidates)
        if not ordered:
            searxng["healthy"] = False
            searxng["error"] = "endpoint is empty"
        else:
            searxng_last_error: str | None = None
            for candidate in ordered:
                healthy, error = await asyncio.to_thread(
                    http_endpoint_prober,
                    candidate,
                    timeout_s=service_timeout,
                    path=service_path,
                    healthy_status_codes={400},
                )
                if healthy:
                    searxng["endpoint"] = candidate
                    searxng["healthy"] = True
                    searxng["error"] = None
                    break
                searxng_last_error = error
            else:
                searxng["endpoint"] = ordered[0]
                searxng["healthy"] = False
                searxng["error"] = searxng_last_error or "probe failed"
    _finalize_optional_status("search_searxng", searxng)

    app.state.optional_services_status = statuses
    app.state.optional_services_last_probe = probe_time


def _optional_services_snapshot(app: FastAPIX) -> OptionalServicesStatus:
    settings: Settings = app.state.settings
    snapshot = _build_optional_status_template(settings)

    current: OptionalServicesStatus = app.state.optional_services_status

    snapshot["storage_chroma"]["status"] = current["storage_chroma"]["status"]
    snapshot["storage_chroma"]["healthy"] = current["storage_chroma"]["healthy"]
    snapshot["storage_chroma"]["endpoint"] = current["storage_chroma"]["endpoint"]
    snapshot["storage_chroma"]["error"] = current["storage_chroma"]["error"]
    snapshot["storage_chroma"]["error_code"] = current["storage_chroma"]["error_code"]
    snapshot["storage_chroma"]["recovery_hint"] = current["storage_chroma"]["recovery_hint"]
    snapshot["storage_chroma"]["last_probe"] = current["storage_chroma"]["last_probe"]

    snapshot["cache_redis"]["status"] = current["cache_redis"]["status"]
    snapshot["cache_redis"]["healthy"] = current["cache_redis"]["healthy"]
    snapshot["cache_redis"]["endpoint"] = current["cache_redis"]["endpoint"]
    snapshot["cache_redis"]["error"] = current["cache_redis"]["error"]
    snapshot["cache_redis"]["error_code"] = current["cache_redis"]["error_code"]
    snapshot["cache_redis"]["recovery_hint"] = current["cache_redis"]["recovery_hint"]
    snapshot["cache_redis"]["last_probe"] = current["cache_redis"]["last_probe"]

    snapshot["search_searxng"]["status"] = current["search_searxng"]["status"]
    snapshot["search_searxng"]["healthy"] = current["search_searxng"]["healthy"]
    snapshot["search_searxng"]["endpoint"] = current["search_searxng"]["endpoint"]
    snapshot["search_searxng"]["error"] = current["search_searxng"]["error"]
    snapshot["search_searxng"]["error_code"] = current["search_searxng"]["error_code"]
    snapshot["search_searxng"]["recovery_hint"] = current["search_searxng"]["recovery_hint"]
    snapshot["search_searxng"]["last_probe"] = current["search_searxng"]["last_probe"]

    snapshot["ollama"]["status"] = current["ollama"]["status"]
    snapshot["ollama"]["healthy"] = current["ollama"]["healthy"]
    snapshot["ollama"]["endpoint"] = current["ollama"]["endpoint"]
    snapshot["ollama"]["hosts"] = dict(current["ollama"]["hosts"])
    snapshot["ollama"]["error"] = current["ollama"]["error"]
    snapshot["ollama"]["error_code"] = current["ollama"]["error_code"]
    snapshot["ollama"]["recovery_hint"] = current["ollama"]["recovery_hint"]
    snapshot["ollama"]["last_probe"] = current["ollama"]["last_probe"]

    legacy_ollama_hosts = dict(app.state.ollama_hosts_status or {})
    if legacy_ollama_hosts:
        ollama = snapshot["ollama"]
        if not ollama["hosts"]:
            ollama["hosts"] = legacy_ollama_hosts
        if ollama["healthy"] is None:
            ollama["healthy"] = any(bool(item["healthy"]) for item in legacy_ollama_hosts.values())
        if ollama["last_probe"] is None:
            ollama["last_probe"] = app.state.ollama_monitor_last_probe

    _finalize_optional_status("storage_chroma", snapshot["storage_chroma"])
    _finalize_optional_status("cache_redis", snapshot["cache_redis"])
    _finalize_optional_status("ollama", snapshot["ollama"])
    _finalize_optional_status("search_searxng", snapshot["search_searxng"])

    return snapshot


async def _run_optional_services_monitor(
    app: FastAPIX,
    stop_event: asyncio.Event,
    *,
    interval_s: float,
    timeout_s: float,
    optional_services_refresher: OptionalServicesRefresher,
) -> None:
    while not stop_event.is_set():
        try:
            await optional_services_refresher(
                app,
                timeout_s=timeout_s,
            )
        except Exception:
            logger.exception("Optional services monitor probe failed")

        try:
            await asyncio.wait_for(stop_event.wait(), timeout=interval_s)
        except TimeoutError:
            continue


def create_app(
    settings: Settings | None = None,
    *,
    db_manager: AsyncDBManager | None = None,
    vector_store: VectorStore | None = None,
    task_queue: TaskQueue | None = None,
    cache_provider: CacheProvider | None = None,
    plugins_entry_points_provider: EntryPointsProvider | None = None,
    optional_services_refresher: OptionalServicesRefresher | None = None,
    http_endpoint_prober: HttpEndpointProber | None = None,
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

    resolved_http_endpoint_prober = http_endpoint_prober or _probe_http_endpoint

    async def _default_optional_services_refresher(app: FastAPIX, *, timeout_s: float) -> None:
        await _refresh_optional_services_status(
            app,
            timeout_s=timeout_s,
            http_endpoint_prober=resolved_http_endpoint_prober,
        )

    resolved_optional_services_refresher = optional_services_refresher or _default_optional_services_refresher

    @asynccontextmanager
    async def lifespan(app: FastAPIX):
        optional_monitor_stop: asyncio.Event | None = None
        optional_monitor_task: asyncio.Task[None] | None = None

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

        app.state.ollama_hosts_status = {}
        app.state.ollama_monitor_last_probe = None
        app.state.optional_services_status = _build_optional_status_template(app.state.settings)
        app.state.optional_services_last_probe = None

        if env_bool(CRYSTALITH_OPTIONAL_SERVICES_MONITOR_ENABLED, OPTIONAL_SERVICES_MONITOR_ENABLED_DEFAULT):
            interval_s = max(
                0.1,
                env_float(CRYSTALITH_OPTIONAL_SERVICES_MONITOR_INTERVAL_S, OPTIONAL_SERVICES_MONITOR_INTERVAL_S_DEFAULT),
            )
            timeout_s = max(
                0.1,
                env_float(CRYSTALITH_OPTIONAL_SERVICES_MONITOR_TIMEOUT_S, OPTIONAL_SERVICES_MONITOR_TIMEOUT_S_DEFAULT),
            )
            optional_monitor_stop = asyncio.Event()
            optional_monitor_task = asyncio.create_task(
                _run_optional_services_monitor(
                    app,
                    optional_monitor_stop,
                    interval_s=interval_s,
                    timeout_s=timeout_s,
                    optional_services_refresher=resolved_optional_services_refresher,
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
                except TimeoutError:
                    optional_monitor_task.cancel()
                    with suppress(asyncio.CancelledError):
                        await optional_monitor_task
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
    app.state.optional_services_status = _build_optional_status_template(resolved)
    app.state.optional_services_last_probe = None
    app.state.ollama_hosts_status = {}
    app.state.ollama_monitor_last_probe = None

    @app.get("/health", include_in_schema=False)
    async def health() -> dict[str, str]:
        return {"status": "ok"}

    @app.get("/health/dependencies", include_in_schema=False)
    async def dependency_health(force: bool = False) -> dict[str, object]:
        has_legacy_ollama_state = bool(app.state.ollama_hosts_status)
        monitor_enabled = env_bool(CRYSTALITH_OPTIONAL_SERVICES_MONITOR_ENABLED, OPTIONAL_SERVICES_MONITOR_ENABLED_DEFAULT)
        needs_refresh = force or (
            not monitor_enabled
            or (app.state.optional_services_last_probe is None and not has_legacy_ollama_state)
        )
        if needs_refresh:
            try:
                await resolved_optional_services_refresher(
                    app,
                    timeout_s=1.0,
                )
            except Exception:
                logger.exception("Dependency health probe refresh failed")

        optional_status = _optional_services_snapshot(app)

        return {
            "status": "ok",
            "generated_at": _iso_now(),
            "last_probe": app.state.optional_services_last_probe,
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
        rendered = get_scalar_api_reference(
            openapi_url=resolved.app.openapi_path,
            title=resolved.app.name,
        )
        if isinstance(rendered, Response):
            return rendered
        return HTMLResponse(rendered)

    register_routers(app)
    return app
