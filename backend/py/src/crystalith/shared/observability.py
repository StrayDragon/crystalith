from __future__ import annotations

import uuid
from typing import Literal

from pydantic import ValidationError
from pydantic_ai.exceptions import UnexpectedModelBehavior


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
    return "model_error"
