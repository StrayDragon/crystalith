from __future__ import annotations

import datetime
from dataclasses import dataclass

from fastapi import HTTPException

from crystalith.shared.db import Source
from crystalith.shared.types import SourceStatus


SOURCE_ERROR_PARSER_FAILED = "PARSER_FAILED"
SOURCE_ERROR_EMBEDDING_FAILED = "EMBEDDING_FAILED"
SOURCE_ERROR_VECTOR_STORE_FAILED = "VECTOR_STORE_FAILED"
SOURCE_ERROR_URL_FETCH_BLOCKED = "URL_FETCH_BLOCKED"
SOURCE_ERROR_EXTRACTOR_TIMEOUT = "EXTRACTOR_TIMEOUT"
SOURCE_ERROR_EXTRACTOR_FAILED = "EXTRACTOR_FAILED"
SOURCE_ERROR_OPTIONAL_SERVICE_UNAVAILABLE = "OPTIONAL_SERVICE_UNAVAILABLE"
SOURCE_ERROR_INGESTION_FAILED = "SOURCE_INGESTION_FAILED"


@dataclass(frozen=True, slots=True)
class SourceFailure:
    error_code: str
    message: str
    recovery_hint: str | None = None
    status_code: int = 500
    details: object | None = None


def apply_source_failure(source: Source, failure: SourceFailure) -> None:
    source.status = SourceStatus.FAILED
    source.error_code = failure.error_code
    source.error_message = (failure.message or "").strip()[:512] or None
    source.recovery_hint = (failure.recovery_hint or "").strip() or None
    source.last_error_at = datetime.datetime.now(datetime.UTC)


def raise_source_failure(failure: SourceFailure) -> None:
    payload: dict[str, object] = {
        "error_code": failure.error_code,
        "message": failure.message,
    }
    if failure.details is not None:
        payload["details"] = failure.details
    raise HTTPException(status_code=failure.status_code, detail=payload)
