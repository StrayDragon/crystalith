"""FastAPI 应用增强入口."""

from __future__ import annotations

from typing import Any

from fastapi import FastAPI
from fastapi.openapi.utils import get_openapi
from typing_extensions import override

from .schema_enhancer import enhance_openapi_schema


class FastAPIX(FastAPI):
    """支持 MetaInfoXEnum 自动增强的 FastAPI 扩展类."""

    @override
    def openapi(self) -> dict[str, Any]:
        if not self.openapi_schema:
            self.openapi_schema = get_openapi(
                title=self.title,
                version=self.version,
                openapi_version=self.openapi_version,
                summary=self.summary,
                description=self.description,
                terms_of_service=self.terms_of_service,
                contact=self.contact,
                license_info=self.license_info,
                routes=self.routes,
                webhooks=self.webhooks.routes if hasattr(self, "webhooks") else None,
                tags=self.openapi_tags,
                servers=self.servers,
                separate_input_output_schemas=self.separate_input_output_schemas,
            )

            self.openapi_schema = enhance_openapi_schema(self.openapi_schema)

        return self.openapi_schema
