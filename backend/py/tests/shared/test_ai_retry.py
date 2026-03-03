from __future__ import annotations

import asyncio
import datetime as dt

import pytest

from crystalith.shared.ai.retry import extract_retry_after, is_retryable_error, run_with_retry


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


def test_extract_retry_after_supports_numeric_and_http_date_values() -> None:
    assert extract_retry_after(_Err("x")) is None
    assert extract_retry_after(_Err("x", headers={"Retry-After": "2"})) == 2.0
    assert extract_retry_after(_Err("x", response=_Resp(429, headers={"retry-after": "3"}))) == 3.0

    past = dt.datetime(2015, 10, 21, 7, 28, 0, tzinfo=dt.UTC)
    header_value = past.strftime("%a, %d %b %Y %H:%M:%S GMT")
    assert extract_retry_after(_Err("x", headers={"Retry-After": header_value})) == 0.0


def test_is_retryable_error_detects_status_codes_and_messages() -> None:
    assert is_retryable_error(TimeoutError()) is True
    assert is_retryable_error(_Err("x", status_code=429)) is True
    assert is_retryable_error(_Err("rate limit exceeded")) is True
    assert is_retryable_error(_Err("nope", status_code=400)) is False


@pytest.mark.asyncio
async def test_run_with_retry_respects_retry_after_header(monkeypatch) -> None:
    sleeps: list[float] = []

    async def fake_sleep(value: float) -> None:
        sleeps.append(value)

    # Mock reason: avoid real delay while asserting backoff timing behavior.
    monkeypatch.setattr(asyncio, "sleep", fake_sleep)

    attempts = 0

    async def operation() -> int:
        nonlocal attempts
        attempts += 1
        if attempts < 2:
            raise _Err("x", response=_Resp(429, headers={"Retry-After": "0"}))
        return 1

    result = await run_with_retry(operation, timeout=None, max_retries=3)
    assert result == 1
    assert sleeps and sleeps[0] == 0.0


@pytest.mark.asyncio
async def test_run_with_retry_respects_total_timeout_budget(monkeypatch) -> None:
    sleeps: list[float] = []

    async def fake_sleep(value: float) -> None:
        sleeps.append(value)

    # Mock reason: avoid real delay while asserting timeout budget behavior.
    monkeypatch.setattr(asyncio, "sleep", fake_sleep)

    async def operation() -> int:
        raise _Err("x", response=_Resp(429, headers={"Retry-After": "10"}))

    with pytest.raises(asyncio.TimeoutError):
        await run_with_retry(operation, timeout=None, total_timeout=0.01, max_retries=3)

    assert sleeps == []
