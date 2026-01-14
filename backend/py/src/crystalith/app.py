from __future__ import annotations

import logging
import os
from pathlib import Path
from typing import Any

from fastapi.responses import HTMLResponse, Response
from scalar_fastapi import get_scalar_api_reference

from cl_fastapix import FastAPIX
from cl_sqlalchemyx.mgrs import AsyncDBManager

from .config import ConfigManager, Settings
from .db import create_all, create_db_manager
from .api import notebooks_router, qa_router, refine_router, sources_router
from .vector_index import InMemoryVectorIndex

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
    vector_index: InMemoryVectorIndex | None = None,
) -> FastAPIX:
    resolved = settings or _load_settings()

    app = FastAPIX(
        title=resolved.app.name,
        openapi_url=resolved.app.openapi_path,
        docs_url=None,
        redoc_url=None,
    )

    app.state.settings = resolved
    app.state.db = db_manager or create_db_manager(resolved.database.url)
    app.state.vector_index = vector_index if vector_index is not None else InMemoryVectorIndex()

    if _env_bool("AUTO_DB_INIT", False):

        @app.on_event("startup")
        async def init_db() -> None:
            await create_all(app.state.db.async_engine)

    @app.get(resolved.app.openapi_ui_path, include_in_schema=False)
    def scalar_docs() -> Response:
        rendered: Any = get_scalar_api_reference(
            openapi_url=resolved.app.openapi_path,
            title=resolved.app.name,
        )
        if isinstance(rendered, Response):
            return rendered
        return HTMLResponse(rendered)

    @app.on_event("shutdown")
    async def close_db() -> None:
        await app.state.db.close()

    app.include_router(notebooks_router)
    app.include_router(qa_router)
    app.include_router(refine_router)
    app.include_router(sources_router)

    return app
