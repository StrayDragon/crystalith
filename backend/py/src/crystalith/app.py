from __future__ import annotations

import logging
import os
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Any

from fastapi.responses import HTMLResponse, Response
from scalar_fastapi import get_scalar_api_reference

from cl_fastapix import FastAPIX
from cl_sqlalchemyx.mgrs import AsyncDBManager

from .config import ConfigManager, Settings
from .db import create_all, create_db_manager
from .api import (
    analysis_router,
    audio_overview_router,
    messages_router,
    notebooks_router,
    outputs_router,
    qa_router,
    refine_router,
    sessions_router,
    sources_router,
    suggestions_router,
    tasks_router,
    video_overview_router,
)
from .tasks import TaskQueue
from .vector_storage import VectorStore, create_vector_store

logger = logging.getLogger(__name__)


def _load_settings() -> Settings:
    config_path = Path("config/app.yaml")
    if config_path.is_file():
        schema_path = config_path.parent / "schema.json"
        manager = ConfigManager(config_path, schema_path)
        if not schema_path.exists():
            manager.write_schema()
        return manager.load()
    logger.warning(
        "Config file not found at %s (cwd=%s). Using default settings.",
        config_path.resolve(),
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
    app.include_router(audio_overview_router)
    app.include_router(analysis_router)
    app.include_router(qa_router)
    app.include_router(outputs_router)
    app.include_router(refine_router)
    app.include_router(video_overview_router)
    app.include_router(sessions_router)
    app.include_router(messages_router)
    app.include_router(sources_router)
    app.include_router(suggestions_router)
    app.include_router(tasks_router)

    return app
