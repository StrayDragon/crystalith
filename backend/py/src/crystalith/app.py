from __future__ import annotations

from typing import Any

from fastapi.responses import HTMLResponse, Response
from scalar_fastapi import get_scalar_api_reference

from cl_fastapix import FastAPIX

from .config import Settings


def create_app(settings: Settings | None = None) -> FastAPIX:
    resolved = settings or Settings()

    app = FastAPIX(
        title=resolved.app.name,
        openapi_url=resolved.app.openapi_path,
        docs_url=None,
        redoc_url=None,
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

    return app
