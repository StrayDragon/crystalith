from __future__ import annotations

import pytest


@pytest.mark.asyncio
async def test_auth_enabled_requires_token(client, app) -> None:
    app.state.settings.app.auth.enabled = True
    app.state.settings.app.auth.api_key = "secret"

    resp = await client.post("/v1/notebooks", json={"name": "Auth Required"})

    assert resp.status_code == 401
    payload = resp.json()
    assert payload["error_code"] == "AUTH_REQUIRED"
    assert resp.headers.get("WWW-Authenticate") == "Bearer"


@pytest.mark.asyncio
async def test_auth_enabled_missing_config_returns_500(client, app) -> None:
    app.state.settings.app.auth.enabled = True
    app.state.settings.app.auth.api_key = "   "

    resp = await client.post("/v1/notebooks", json={"name": "Auth Misconfigured"})

    assert resp.status_code == 500
    payload = resp.json()
    assert payload["error_code"] == "AUTH_MISCONFIGURED"


@pytest.mark.asyncio
async def test_auth_enabled_rejects_invalid_token(client, app) -> None:
    app.state.settings.app.auth.enabled = True
    app.state.settings.app.auth.api_key = "secret"

    resp = await client.post(
        "/v1/notebooks",
        json={"name": "Auth Invalid"},
        headers={"Authorization": "Bearer wrong"},
    )

    assert resp.status_code == 401
    payload = resp.json()
    assert payload["error_code"] == "AUTH_INVALID"
    assert resp.headers.get("WWW-Authenticate") == "Bearer"


@pytest.mark.asyncio
async def test_auth_enabled_accepts_x_api_key_header(client, app) -> None:
    app.state.settings.app.auth.enabled = True
    app.state.settings.app.auth.api_key = "secret"

    resp = await client.post(
        "/v1/notebooks",
        json={"name": "Auth Success"},
        headers={"X-API-Key": "secret"},
    )

    assert resp.status_code == 201
