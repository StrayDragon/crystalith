from __future__ import annotations

from fastapi import APIRouter

from .api_ingest import router as ingest_router
from .api_qa import router as qa_router
from .api_sources import router as sources_router
from .api_summary import router as summary_router
from .api_tags import router as tags_router

_PREFIX = "/v1/notebooks/{notebook_id}/sources"

router = APIRouter(tags=["sources"])

router.include_router(ingest_router, prefix=_PREFIX)
router.include_router(sources_router, prefix=_PREFIX)
router.include_router(tags_router, prefix=_PREFIX)
router.include_router(summary_router, prefix=_PREFIX)
router.include_router(qa_router, prefix=_PREFIX)
