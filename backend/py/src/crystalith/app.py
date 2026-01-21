from __future__ import annotations

import logging
import os
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Any

from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse, Response
from scalar_fastapi import get_scalar_api_reference

from cl_fastapix import FastAPIX
from cl_sqlalchemyx.mgrs import AsyncDBManager

from sqlalchemy import delete, select

from .config import ConfigManager, Settings
from .db import Source, SourceStatus, create_all, create_db_manager
from .api import (
    analysis_router,
    messages_router,
    notebooks_router,
    outputs_router,
    qa_router,
    refine_router,
    sessions_router,
    sources_router,
    suggestions_router,
    tasks_router,
    workspace_tools_router,
)
from .tasks import TaskQueue
from .vector_storage import VectorStore, create_vector_store

logger = logging.getLogger(__name__)


def _find_config_path() -> Path | None:
    cwd = Path.cwd()
    for parent in (cwd, *cwd.parents):
        candidate = parent / "config/app.yaml"
        if candidate.is_file():
            return candidate
    return None


def _load_settings() -> Settings:
    config_path = _find_config_path()
    if config_path is not None:
        schema_path = config_path.parent / "schema.json"
        manager = ConfigManager(config_path, schema_path)
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


def create_app(
    settings: Settings | None = None,
    *,
    db_manager: AsyncDBManager | None = None,
    vector_store: VectorStore | None = None,
    task_queue: TaskQueue | None = None,
) -> FastAPIX:
    resolved = settings or _load_settings()

    db = db_manager or create_db_manager(resolved.database.url)
    store = vector_store if vector_store is not None else create_vector_store(resolved)
    queue = task_queue or TaskQueue(
        db_manager=db,
        settings=resolved,
        vector_store=store,
    )

    @asynccontextmanager
    async def lifespan(app: FastAPIX):
        if _env_bool("AUTO_DB_INIT", False):
            await create_all(app.state.db.async_engine)

        # Clean up sources with status=FAILED (failed ingestion)
        if _env_bool("AUTO_CLEANUP_FAILED_SOURCES", True):
            async with app.state.db.got_manual_session() as session:
                # Find sources with status=FAILED
                failed_sources = await session.execute(
                    select(Source).where(Source.status == SourceStatus.FAILED)
                )
                failed_list = list(failed_sources.scalars().all())
                if failed_list:
                    source_ids = [s.id for s in failed_list]
                    await session.execute(
                        delete(Source).where(Source.id.in_(source_ids))
                    )
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
            stop_worker = getattr(app.state.task_queue, "stop_worker", None)
            if stop_worker is not None:
                await stop_worker()

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
    app.state.task_queue = queue

    # Add CORS middleware for frontend development
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
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

    app.include_router(notebooks_router)
    app.include_router(analysis_router)
    app.include_router(qa_router)
    app.include_router(outputs_router)
    app.include_router(refine_router)
    app.include_router(sessions_router)
    app.include_router(messages_router)
    app.include_router(sources_router)
    app.include_router(suggestions_router)
    app.include_router(tasks_router)
    app.include_router(workspace_tools_router)

    return app
