from __future__ import annotations

import asyncio
import uuid
from typing import Literal

from pydantic import ValidationError
from pydantic_ai.exceptions import ModelAPIError, ModelHTTPError, UnexpectedModelBehavior
from sqlalchemy.exc import SQLAlchemyError

try:
    import httpx
except ImportError:  # pragma: no cover
    httpx = None  # type: ignore[assignment]

try:
    import openai
except ImportError:  # pragma: no cover
    openai = None  # type: ignore[assignment]


ErrorKind = Literal[
    "embed_error",
    "retrieval_error",
    "model_error",
    "validation_error",
    "persist_error",
    "unknown_error",
]


def new_trace_id() -> str:
    return uuid.uuid4().hex


def classify_error_kind(error: BaseException) -> ErrorKind:
    if isinstance(error, UnexpectedModelBehavior):
        return "validation_error"
    if isinstance(error, ValidationError):
        return "validation_error"
    if isinstance(error, SQLAlchemyError):
        return "persist_error"
    if isinstance(error, (ModelAPIError, ModelHTTPError)):
        return "model_error"
    if isinstance(error, (asyncio.TimeoutError, TimeoutError)):
        return "model_error"
    if httpx is not None and isinstance(error, httpx.HTTPError):
        return "model_error"
    if openai is not None and isinstance(error, openai.OpenAIError):
        return "model_error"
    return "unknown_error"
