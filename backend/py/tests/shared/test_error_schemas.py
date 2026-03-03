from __future__ import annotations


from crystalith.shared.schemas.errors import (
    build_error_response,
    build_error_response_from_exception,
    default_message_for_status,
    error_code_for_status,
    parse_retry_after,
    retry_after_from_exception,
    retry_after_from_headers,
    status_code_from_exception,
)


class _Resp:
    def __init__(self, status_code: int, headers=None):  # noqa: ANN001
        self.status_code = status_code
        self.headers = headers or {}


class _Err(Exception):
    def __init__(self, message: str, *, status_code=None, response=None, headers=None):  # noqa: ANN001
        super().__init__(message)
        self.status_code = status_code
        self.response = response
        self.headers = headers or {}


def test_error_code_and_default_message_lookup() -> None:
    assert error_code_for_status(404) == "NOT_FOUND"
    assert error_code_for_status(499) == "HTTP_499"
    assert default_message_for_status(404)
    assert default_message_for_status(499)


def test_parse_retry_after_handles_numbers_and_dates() -> None:
    assert parse_retry_after(None) is None
    assert parse_retry_after(-1) == 0
    assert parse_retry_after(2.2) == 2
    assert parse_retry_after(object()) is None
    assert parse_retry_after("   ") is None
    assert parse_retry_after("2.9") == 2
    # Past date becomes 0 seconds remaining.
    assert parse_retry_after("Wed, 21 Oct 2015 07:28:00 GMT") == 0


def test_retry_after_from_headers_reads_mapping_and_getter() -> None:
    assert retry_after_from_headers({"Retry-After": "2"}) == 2

    class Obj:
        def get(self, key: str):  # noqa: ANN001
            if key.lower() == "retry-after":
                return "3"
            return None

    assert retry_after_from_headers(Obj()) == 3


def test_status_code_from_exception_detects_common_shapes() -> None:
    assert status_code_from_exception(_Err("x", status_code=429)) == 429
    assert status_code_from_exception(_Err("x", response=_Resp(502))) == 502
    assert status_code_from_exception(TimeoutError("timeout")) == 503
    assert status_code_from_exception(TimeoutError()) == 503


def test_build_error_response_accepts_multiple_detail_shapes() -> None:
    model = build_error_response(
        status_code=400,
        detail={"error_code": "X", "message": "M", "details": {"a": 1}, "retry_after": "2"},
        headers={"Retry-After": "9"},
    )
    assert model.error_code == "X"
    assert model.message == "M"
    assert model.details == {"a": 1}
    assert model.retry_after == 2

    model2 = build_error_response(status_code=404, detail="Not found")
    assert model2.message == "Not found"

    model3 = build_error_response(status_code=404, detail={"detail": "Oops", "details": {"x": 1}})
    assert model3.message == "Oops"
    assert model3.details == {"x": 1}

    model4 = build_error_response(status_code=404, detail={"other": True})
    assert model4.error_code == "NOT_FOUND"
    assert model4.details == {"other": True}

    model5 = build_error_response(status_code=500, detail=None)
    assert model5.message == default_message_for_status(500)


def test_retry_after_from_exception_prefers_response_headers() -> None:
    err = _Err("x", response=_Resp(429, headers={"Retry-After": "4"}), headers={"Retry-After": "1"})
    assert retry_after_from_exception(err) == 4


def test_build_error_response_from_exception_formats_details() -> None:
    err = _Err("boom", status_code=500)
    model = build_error_response_from_exception(err)
    assert model.error_code == "INTERNAL_ERROR"
    assert model.details

    err2 = _Err("bad", status_code=400)
    model2 = build_error_response_from_exception(err2)
    assert model2.message == "bad"
    assert model2.details is None

    model3 = build_error_response_from_exception(_Err("", status_code=500))
    assert model3.details == "_Err"


def test_build_error_response_rejects_invalid_retry_after_type() -> None:
    model = build_error_response(status_code=429, detail={"error_code": "X", "message": "M", "retry_after": object()})
    assert model.retry_after is None
