from __future__ import annotations

import secrets

from fastapi import HTTPException, Request


def _extract_api_key(request: Request) -> str | None:
    authorization = request.headers.get("Authorization")
    if authorization:
        scheme, _, token = authorization.partition(" ")
        if scheme.strip().lower() == "bearer" and token.strip():
            return token.strip()

    api_key = request.headers.get("X-API-Key")
    if api_key and api_key.strip():
        return api_key.strip()

    return None


def require_api_key(request: Request) -> None:
    settings = request.app.state.settings
    auth = settings.app.auth

    if not auth.enabled:
        return

    configured_api_key = (auth.api_key or "").strip()
    if not configured_api_key:
        raise HTTPException(
            status_code=500,
            detail={
                "error_code": "AUTH_MISCONFIGURED",
                "message": "鉴权配置错误",
                "details": "app.auth.enabled=true requires app.auth.api_key",
            },
        )

    provided_api_key = _extract_api_key(request)
    if not provided_api_key:
        raise HTTPException(
            status_code=401,
            detail={
                "error_code": "AUTH_REQUIRED",
                "message": "需要鉴权 token",
                "details": "Provide 'Authorization: Bearer <token>' (or 'X-API-Key')",
            },
            headers={"WWW-Authenticate": "Bearer"},
        )

    if not secrets.compare_digest(provided_api_key, configured_api_key):
        raise HTTPException(
            status_code=401,
            detail={
                "error_code": "AUTH_INVALID",
                "message": "鉴权 token 无效",
            },
            headers={"WWW-Authenticate": "Bearer"},
        )
