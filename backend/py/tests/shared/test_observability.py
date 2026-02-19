from __future__ import annotations

import openai
from pydantic_ai.exceptions import UnexpectedModelBehavior

from crystalith.shared.observability import classify_error_kind, new_trace_id


def test_new_trace_id_is_hex() -> None:
    trace_id = new_trace_id()
    assert len(trace_id) == 32
    int(trace_id, 16)


def test_classify_error_kind_handles_validation_errors() -> None:
    assert classify_error_kind(UnexpectedModelBehavior("nope")) == "validation_error"


def test_classify_error_kind_maps_provider_errors_to_model_error() -> None:
    assert classify_error_kind(openai.OpenAIError("boom")) == "model_error"


def test_classify_error_kind_defaults_to_unknown_error() -> None:
    assert classify_error_kind(RuntimeError("boom")) == "unknown_error"
