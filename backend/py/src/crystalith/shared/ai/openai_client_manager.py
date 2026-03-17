from __future__ import annotations

import hashlib
from collections.abc import Mapping
from dataclasses import dataclass

import httpx
from openai import AsyncOpenAI


def _freeze_headers(headers: Mapping[str, str] | None) -> tuple[tuple[str, str], ...]:
    if headers is None:
        return ()
    return tuple(sorted((str(k), str(v)) for k, v in headers.items()))


def _api_key_fingerprint(api_key: str) -> str:
    trimmed = api_key.strip()
    if not trimmed:
        return ""
    return hashlib.sha256(trimmed.encode("utf-8")).hexdigest()


@dataclass(frozen=True, slots=True)
class OpenAIClientKey:
    api_key_fingerprint: str
    base_url: str
    organization: str | None
    project: str | None
    timeout: float
    max_retries: int
    proxy: str | None
    verify_ssl: bool
    headers: tuple[tuple[str, str], ...]


class OpenAIClientManager:
    """
    Process-lifetime cache for OpenAI SDK clients.

    We keep one client per unique (base_url, api_key, request options) tuple to:
    - reuse HTTP connection pools
    - ensure request_options (proxy/verify_ssl/headers/timeout) are applied consistently
    - allow clean shutdown by closing clients explicitly
    """

    def __init__(self) -> None:
        self._clients: dict[OpenAIClientKey, AsyncOpenAI] = {}

    def get(
        self,
        *,
        api_key: str,
        base_url: str,
        organization: str | None,
        project: str | None,
        timeout: float,
        proxy: str | None,
        verify_ssl: bool,
        headers: Mapping[str, str] | None,
        max_retries: int = 0,
    ) -> AsyncOpenAI:
        normalized_api_key = api_key.strip()
        key = OpenAIClientKey(
            api_key_fingerprint=_api_key_fingerprint(normalized_api_key),
            base_url=base_url,
            organization=organization or None,
            project=project or None,
            timeout=float(timeout),
            max_retries=int(max_retries),
            proxy=proxy or None,
            verify_ssl=bool(verify_ssl),
            headers=_freeze_headers(headers),
        )

        existing = self._clients.get(key)
        if existing is not None:
            return existing

        http_client: httpx.AsyncClient | None = None
        if key.proxy is not None or key.verify_ssl is False:
            http_client = httpx.AsyncClient(
                proxy=key.proxy,
                verify=key.verify_ssl,
                timeout=httpx.Timeout(key.timeout),
            )

        default_headers = dict(key.headers) if key.headers else None

        client = AsyncOpenAI(
            api_key=normalized_api_key,
            base_url=key.base_url,
            organization=key.organization,
            project=key.project,
            timeout=key.timeout,
            max_retries=key.max_retries,
            default_headers=default_headers,
            http_client=http_client,
            webhook_secret="",
        )
        self._clients[key] = client
        return client

    async def aclose(self) -> None:
        clients = list(self._clients.values())
        self._clients.clear()
        for client in clients:
            await client.close()


_GLOBAL_OPENAI_CLIENT_MANAGER = OpenAIClientManager()


def get_openai_client_manager() -> OpenAIClientManager:
    return _GLOBAL_OPENAI_CLIENT_MANAGER
