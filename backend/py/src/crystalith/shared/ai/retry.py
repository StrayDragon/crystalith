from __future__ import annotations

import asyncio
import datetime as dt
from collections.abc import Awaitable, Callable, Mapping
from email.utils import parsedate_to_datetime
from functools import wraps
from typing import Any, ParamSpec, TypeVar

from cl_logs.logging import get_logger


log = get_logger(__name__)

P = ParamSpec("P")
T = TypeVar("T")

_RETRYABLE_STATUS_CODES = {408, 409, 425, 429, 500, 502, 503, 504}


def _extract_status_code(error: Exception) -> int | None:
    status_code = getattr(error, "status_code", None)
    if isinstance(status_code, int):
        return status_code
    response = getattr(error, "response", None)
    if response is None:
        return None
    response_status = getattr(response, "status_code", None)
    if isinstance(response_status, int):
        return response_status
    return None


def _read_header(headers: Mapping[str, Any] | Any, name: str) -> str | None:
    if headers is None:
        return None

    if isinstance(headers, Mapping):
        for key, value in headers.items():
            if str(key).lower() == name.lower():
                return str(value)

    getter = getattr(headers, "get", None)
    if callable(getter):
        value = getter(name)
        if value is None:
            value = getter(name.lower())
        if value is None:
            value = getter(name.title())
        if value is not None:
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
        retry_at = retry_at.replace(tzinfo=dt.timezone.utc)

    seconds = (retry_at - dt.datetime.now(dt.timezone.utc)).total_seconds()
    return max(0.0, seconds)


def extract_retry_after(error: Exception) -> float | None:
    response = getattr(error, "response", None)
    if response is not None:
        headers = getattr(response, "headers", None)
        parsed = _parse_retry_after(_read_header(headers, "retry-after"))
        if parsed is not None:
            return parsed

    headers = getattr(error, "headers", None)
    parsed = _parse_retry_after(_read_header(headers, "retry-after"))
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


async def run_with_retry(
    operation: Callable[[], Awaitable[T]],
    *,
    timeout: float | None,
    max_retries: int,
    initial_delay: float = 1.0,
    max_delay: float = 10.0,
    factor: float = 2.0,
    retry_if: Callable[[Exception], bool] | None = None,
) -> T:
    attempt = 0

    while True:
        try:
            if timeout is None:
                return await operation()
            return await asyncio.wait_for(operation(), timeout=timeout)
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

            attempt += 1
            log.warning(
                "provider call failed, retrying",
                attempt=attempt,
                max_retries=max_retries,
                delay=delay,
                error=str(error),
            )
            await asyncio.sleep(max(0.0, delay))


def with_retry(
    *,
    timeout: float | None = None,
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
                max_retries=max_retries,
                initial_delay=initial_delay,
                max_delay=max_delay,
                factor=factor,
                retry_if=retry_if,
            )

        return wrapped

    return decorator
