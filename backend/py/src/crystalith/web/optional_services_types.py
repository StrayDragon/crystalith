from __future__ import annotations

from typing import Literal, TypedDict

ServiceKey = Literal["storage_chroma", "cache_redis", "ollama", "search_searxng"]
ServiceStatus = Literal["unknown", "disabled", "healthy", "degraded"]
DegradePolicy = Literal["core_available", "fail_closed"]


class OptionalServiceProbeDict(TypedDict):
    enabled: bool
    timeout_s: float
    interval_s: float
    path: str | None


class StorageChromaStatus(TypedDict):
    service: Literal["chroma"]
    enabled: bool
    provider: str
    endpoint: str | None
    status: ServiceStatus
    healthy: bool | None
    error: str | None
    error_code: str | None
    recovery_hint: str | None
    last_probe: str | None
    probe: OptionalServiceProbeDict
    degrade_policy: DegradePolicy


class CacheRedisStatus(TypedDict):
    service: Literal["redis"]
    enabled: bool
    provider: str
    endpoint: str | None
    status: ServiceStatus
    healthy: bool | None
    error: str | None
    error_code: str | None
    recovery_hint: str | None
    last_probe: str | None
    probe: OptionalServiceProbeDict
    degrade_policy: DegradePolicy


class OllamaHostStatus(TypedDict):
    healthy: bool
    error: str | None
    model_count: int | None


class OllamaStatus(TypedDict):
    service: Literal["ollama"]
    enabled: bool
    endpoint: str | None
    status: ServiceStatus
    healthy: bool | None
    hosts: dict[str, OllamaHostStatus]
    error: str | None
    error_code: str | None
    recovery_hint: str | None
    last_probe: str | None
    probe: OptionalServiceProbeDict
    degrade_policy: DegradePolicy


class SearchSearxngStatus(TypedDict):
    service: Literal["searxng"]
    enabled: bool
    endpoint: str | None
    timeout_s: int
    status: ServiceStatus
    healthy: bool | None
    error: str | None
    error_code: str | None
    recovery_hint: str | None
    last_probe: str | None
    probe: OptionalServiceProbeDict
    degrade_policy: DegradePolicy


class OptionalServicesStatus(TypedDict):
    storage_chroma: StorageChromaStatus
    cache_redis: CacheRedisStatus
    ollama: OllamaStatus
    search_searxng: SearchSearxngStatus


OptionalServiceStatus = StorageChromaStatus | CacheRedisStatus | OllamaStatus | SearchSearxngStatus
