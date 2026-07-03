from __future__ import annotations

from typing import Literal, TypedDict

ServiceKey = Literal["storage_chroma", "cache_redis", "search_searxng"]
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
    search_searxng: SearchSearxngStatus


OptionalServiceStatus = StorageChromaStatus | CacheRedisStatus | SearchSearxngStatus
