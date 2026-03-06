from __future__ import annotations

import asyncio
import datetime as dt
from collections.abc import Mapping
from email.utils import parsedate_to_datetime
from typing import Protocol, runtime_checkable

import httpx
from pydantic import BaseModel, Field


class ErrorResponse(BaseModel):
    error_code: str
    message: str
    hint: str | None = None
    details: object | None = None
    retry_after: int | None = Field(default=None, ge=0)


_STATUS_ERROR_CODES: dict[int, str] = {
    400: "BAD_REQUEST",
    401: "UNAUTHORIZED",
    403: "FORBIDDEN",
    404: "NOT_FOUND",
    409: "CONFLICT",
    422: "VALIDATION_ERROR",
    429: "RATE_LIMITED",
    500: "INTERNAL_ERROR",
    502: "BAD_GATEWAY",
    503: "SERVICE_UNAVAILABLE",
    504: "GATEWAY_TIMEOUT",
}

_STATUS_DEFAULT_MESSAGES: dict[int, str] = {
    400: "请求参数错误",
    401: "未授权访问",
    403: "无权限访问",
    404: "请求的资源不存在",
    409: "请求冲突",
    422: "请求参数验证失败",
    429: "请求过于频繁，请稍后重试",
    500: "服务器内部错误",
    502: "上游服务不可用",
    503: "服务暂时不可用，请稍后重试",
    504: "上游服务超时",
}


def error_code_for_status(status_code: int) -> str:
    return _STATUS_ERROR_CODES.get(status_code, f"HTTP_{status_code}")


def default_message_for_status(status_code: int) -> str:
    return _STATUS_DEFAULT_MESSAGES.get(status_code, "请求处理失败")


@runtime_checkable
class _HasGet(Protocol):
    def get(self, key: str) -> object | None: ...


def _read_header(headers: object | None, name: str) -> str | None:
    if headers is None:
        return None

    if isinstance(headers, Mapping):
        for key, value in headers.items():
            if str(key).lower() == name.lower():
                return str(value)
        return None

    if isinstance(headers, _HasGet):
        value = headers.get(name)
        if value is None:
            return None
        return str(value)

    return None


def parse_retry_after(value: object) -> int | None:
    if value is None:
        return None

    if isinstance(value, int | float):
        return max(0, int(value))

    if not isinstance(value, str):
        return None

    text = value.strip()
    if not text:
        return None

    try:
        numeric = float(text)
    except ValueError:
        numeric = None

    if numeric is not None:
        return max(0, int(numeric))

    try:
        retry_at = parsedate_to_datetime(text)
    except (TypeError, ValueError, IndexError):
        return None

    if retry_at.tzinfo is None:
        retry_at = retry_at.replace(tzinfo=dt.UTC)

    seconds = int((retry_at - dt.datetime.now(dt.UTC)).total_seconds())
    return max(0, seconds)


def retry_after_from_headers(headers: object | None) -> int | None:
    return parse_retry_after(_read_header(headers, "retry-after"))


@runtime_checkable
class _HasHeaders(Protocol):
    headers: Mapping[str, object]


@runtime_checkable
class _HasResponse(Protocol):
    response: _HasHeaders | None


@runtime_checkable
class _HasStatusCode(Protocol):
    status_code: object


@runtime_checkable
class _HasResponseWithStatusCode(Protocol):
    response: _HasStatusCode | None


def retry_after_from_exception(error: Exception) -> int | None:
    if isinstance(error, httpx.HTTPStatusError):
        return retry_after_from_headers(error.response.headers)

    if isinstance(error, _HasResponse):
        response = error.response
        if response is not None:
            parsed = retry_after_from_headers(response.headers)
            if parsed is not None:
                return parsed

    if isinstance(error, _HasHeaders):
        parsed = retry_after_from_headers(error.headers)
        if parsed is not None:
            return parsed

    return None


def status_code_from_exception(error: Exception) -> int | None:
    if isinstance(error, TimeoutError | asyncio.TimeoutError | httpx.TimeoutException):
        return 503

    if isinstance(error, httpx.HTTPStatusError):
        status_code = error.response.status_code
        if status_code >= 500:
            return 503
        return status_code

    if isinstance(error, httpx.TransportError):
        return 503

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


def build_error_response(
    *,
    status_code: int,
    detail: object,
    headers: Mapping[str, object] | None = None,
) -> ErrorResponse:
    retry_after = retry_after_from_headers(headers)

    if isinstance(detail, dict) and "error_code" in detail and "message" in detail:
        model = ErrorResponse(
            error_code=str(detail.get("error_code") or error_code_for_status(status_code)),
            message=str(detail.get("message") or default_message_for_status(status_code)),
            hint=str(detail.get("hint")) if detail.get("hint") is not None else None,
            details=detail.get("details"),
            retry_after=parse_retry_after(detail.get("retry_after")) or retry_after,
        )
        return model

    if isinstance(detail, str):
        message = detail
        details = None
    elif isinstance(detail, dict):
        detail_message = detail.get("detail")
        if isinstance(detail_message, str):
            message = detail_message
            details = detail.get("details")
        else:
            message = default_message_for_status(status_code)
            details = detail
    elif detail is None:
        message = default_message_for_status(status_code)
        details = None
    else:
        message = default_message_for_status(status_code)
        details = detail

    return ErrorResponse(
        error_code=error_code_for_status(status_code),
        message=message,
        details=details,
        retry_after=retry_after,
    )


def build_error_response_from_exception(error: Exception, *, status_code: int | None = None) -> ErrorResponse:
    resolved_status = status_code or status_code_from_exception(error) or 500
    resolved_retry_after = retry_after_from_exception(error)

    error_text = str(error).strip()
    if resolved_status >= 500:
        message = default_message_for_status(resolved_status)
        details = error_text or error.__class__.__name__
    else:
        message = error_text or default_message_for_status(resolved_status)
        details = None

    return ErrorResponse(
        error_code=error_code_for_status(resolved_status),
        message=message,
        details=details,
        retry_after=resolved_retry_after,
    )
