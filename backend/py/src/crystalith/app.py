from __future__ import annotations

from typing import Any

from fastapi.responses import HTMLResponse, Response
from scalar_fastapi import get_scalar_api_reference

from cl_fastapix import FastAPIX
from cl_sqlalchemyx.mgrs import AsyncDBManager

from .config import Settings
from .db import create_db_manager
from .api import notebooks_router, qa_router, refine_router, sources_router
from .vector_index import InMemoryVectorIndex


def create_app(
    settings: Settings | None = None,
    *,
    db_manager: AsyncDBManager | None = None,
    vector_index: InMemoryVectorIndex | None = None,
) -> FastAPIX:
    resolved = settings or Settings()

    app = FastAPIX(
        title=resolved.app.name,
        openapi_url=resolved.app.openapi_path,
        docs_url=None,
        redoc_url=None,
    )

    app.state.settings = resolved
    app.state.db = db_manager or create_db_manager(resolved.database.url)
    app.state.vector_index = vector_index if vector_index is not None else InMemoryVectorIndex()

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
