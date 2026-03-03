from __future__ import annotations

import asyncio
import datetime as dt
from collections.abc import Awaitable, Callable, Mapping
from email.utils import parsedate_to_datetime
from functools import wraps
from time import perf_counter
from typing import Protocol, runtime_checkable

from cl_logs.logging import get_logger


log = get_logger(__name__)

_RETRYABLE_STATUS_CODES = {408, 409, 425, 429, 500, 502, 503, 504}


@runtime_checkable
class _HasHeaders(Protocol):
    headers: Mapping[str, object]


@runtime_checkable
class _HasResponseWithHeaders(Protocol):
    response: _HasHeaders | None


@runtime_checkable
class _HasStatusCode(Protocol):
    status_code: object


@runtime_checkable
class _HasResponseWithStatusCode(Protocol):
    response: _HasStatusCode | None


def default_retry_budget_s(
    *,
    timeout: float | None,
    max_retries: int,
    initial_delay: float = 1.0,
    max_delay: float = 10.0,
    factor: float = 2.0,
) -> float | None:
    if timeout is None:
        return None

    retries = max(0, int(max_retries))
    delay_budget = 0.0
    for attempt in range(retries):
        delay_budget += min(float(max_delay), float(initial_delay) * (float(factor) ** attempt))

    return float(timeout) + delay_budget


def _extract_status_code(error: Exception) -> int | None:
    if isinstance(error, _HasStatusCode):
        status_code = error.status_code
        if isinstance(status_code, int):
            return status_code

    if isinstance(error, _HasResponseWithStatusCode):
        response = error.response
        if response is not None:
            status_code = response.status_code
            if isinstance(status_code, int):
                return status_code

    return None


def _read_header(headers: Mapping[str, object] | None, name: str) -> str | None:
    if headers is None:
        return None

    for key, value in headers.items():
        if str(key).lower() == name.lower():
            return str(value)

    return None


def _parse_retry_after(value: str | int | float | None) -> float | None:
    if value is None:
        return None

    if isinstance(value, int | float):
        return max(0.0, float(value))

    text = value.strip()
    if not text:
        return None

    try:
        numeric = float(text)
    except ValueError:
        numeric = None

    if numeric is not None:
        return max(0.0, numeric)

    try:
        retry_at = parsedate_to_datetime(text)
    except (TypeError, ValueError, IndexError):
        return None

    if retry_at.tzinfo is None:
        retry_at = retry_at.replace(tzinfo=dt.UTC)

    seconds = (retry_at - dt.datetime.now(dt.UTC)).total_seconds()
    return max(0.0, seconds)


def extract_retry_after(error: Exception) -> float | None:
    if isinstance(error, _HasResponseWithHeaders):
        response = error.response
        if response is not None:
            parsed = _parse_retry_after(_read_header(response.headers, "retry-after"))
            if parsed is not None:
                return parsed

    if isinstance(error, _HasHeaders):
        parsed = _parse_retry_after(_read_header(error.headers, "retry-after"))
        if parsed is not None:
            return parsed

    return None


def is_retryable_error(error: Exception) -> bool:
    if isinstance(error, TimeoutError | asyncio.TimeoutError):
        return True

    status_code = _extract_status_code(error)
    if status_code is not None:
        return status_code in _RETRYABLE_STATUS_CODES

    message = str(error).lower()
    if "timeout" in message:
        return True
    if "rate limit" in message or "too many requests" in message:
        return True
    if "temporarily unavailable" in message:
        return True

    return False


async def run_with_retry[T](
    operation: Callable[[], Awaitable[T]],
    *,
    timeout: float | None,
    max_retries: int,
    total_timeout: float | None = None,
    initial_delay: float = 1.0,
    max_delay: float = 10.0,
    factor: float = 2.0,
    retry_if: Callable[[Exception], bool] | None = None,
) -> T:
    attempt = 0
    started = perf_counter()

    while True:
        remaining_budget = None
        if total_timeout is not None:
            remaining_budget = float(total_timeout) - (perf_counter() - started)
            if remaining_budget <= 0:
                raise TimeoutError("retry budget exceeded")

        try:
            if timeout is None:
                if remaining_budget is None:
                    return await operation()
                return await asyncio.wait_for(operation(), timeout=max(0.0, remaining_budget))

            attempt_timeout = float(timeout)
            if remaining_budget is not None:
                attempt_timeout = min(attempt_timeout, max(0.0, remaining_budget))
            return await asyncio.wait_for(operation(), timeout=attempt_timeout)
        except Exception as error:  # noqa: BLE001 - preserve provider exceptions
            if isinstance(error, asyncio.CancelledError):
                raise

            retryable = retry_if(error) if retry_if is not None else is_retryable_error(error)
            if attempt >= max_retries or not retryable:
                raise

            retry_after = extract_retry_after(error)
            if retry_after is not None:
                delay = retry_after
            else:
                delay = min(max_delay, initial_delay * (factor ** attempt))

            if total_timeout is not None:
                remaining_budget = float(total_timeout) - (perf_counter() - started)
                if remaining_budget <= 0:
                    raise TimeoutError("retry budget exceeded") from error
                if delay > remaining_budget:
                    raise TimeoutError("retry budget exceeded") from error

            attempt += 1
            log.warning(
                "provider call failed, retrying",
                attempt=attempt,
                max_retries=max_retries,
                delay=delay,
                error=str(error),
            )
            await asyncio.sleep(max(0.0, delay))


def with_retry[**P, T](
    *,
    timeout: float | None = None,
    total_timeout: float | None = None,
    max_retries: int = 3,
    initial_delay: float = 1.0,
    max_delay: float = 10.0,
    factor: float = 2.0,
    retry_if: Callable[[Exception], bool] | None = None,
) -> Callable[[Callable[P, Awaitable[T]]], Callable[P, Awaitable[T]]]:
    def decorator(operation: Callable[P, Awaitable[T]]) -> Callable[P, Awaitable[T]]:
        @wraps(operation)
        async def wrapped(*args: P.args, **kwargs: P.kwargs) -> T:
            return await run_with_retry(
                lambda: operation(*args, **kwargs),
                timeout=timeout,
                total_timeout=total_timeout,
                max_retries=max_retries,
                initial_delay=initial_delay,
                max_delay=max_delay,
                factor=factor,
                retry_if=retry_if,
            )

        return wrapped

    return decorator
