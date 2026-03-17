from __future__ import annotations

import ipaddress
import socket
from dataclasses import dataclass
from pathlib import Path
from typing import Literal
from urllib.parse import urlparse

EndpointKind = Literal["docker_internal", "host_local", "external", "unknown"]


@dataclass(frozen=True)
class TcpTarget:
    host: str
    port: int


def is_running_in_docker() -> bool:
    # Heuristic used in many projects; safe fallback to "host".
    return Path("/.dockerenv").exists()


def endpoint_hostname(endpoint: str) -> str | None:
    raw = (endpoint or "").strip()
    if not raw:
        return None

    if "://" in raw:
        parsed = urlparse(raw)
        return parsed.hostname

    # Support "host:port" style without a scheme.
    if ":" in raw and raw.count(":") == 1 and "/" not in raw:
        host, _ = raw.split(":", 1)
        return host.strip() or None

    return None


def endpoint_kind(hostname: str) -> EndpointKind:
    host = (hostname or "").strip().lower()
    if not host:
        return "unknown"

    if host == "localhost":
        return "host_local"

    try:
        ip = ipaddress.ip_address(host)
    except ValueError:
        ip = None

    if ip is not None:
        return "host_local" if ip.is_loopback else "external"

    if "." not in host:
        return "docker_internal"

    return "external"


_KIND_PRIORITY_DOCKER: dict[EndpointKind, int] = {
    "docker_internal": 0,
    "external": 1,
    "host_local": 2,
    "unknown": 3,
}

_KIND_PRIORITY_HOST: dict[EndpointKind, int] = {
    "host_local": 0,
    "external": 1,
    "docker_internal": 2,
    "unknown": 3,
}


def _endpoint_sort_key(ep: str, priority_map: dict[EndpointKind, int]) -> int:
    hostname = endpoint_hostname(ep)
    kind = endpoint_kind(hostname or "")
    return priority_map.get(kind, 99)


def order_endpoint_candidates(
    endpoints: list[str],
    *,
    in_docker: bool | None = None,
) -> list[str]:
    """
    Normalize candidates (trim + de-dup) and reorder by runtime context.

    When running inside Docker, docker-internal hostnames (e.g. ``postgres``,
    ``chromadb``) are preferred over localhost.  On the host the order is
    reversed so that ``127.0.0.1`` candidates come first.

    Within the same kind the original YAML declaration order is preserved
    (stable sort).
    """
    if in_docker is None:
        in_docker = is_running_in_docker()

    ordered: list[str] = []
    seen: set[str] = set()
    for endpoint in endpoints:
        if not endpoint or not endpoint.strip():
            continue
        normalized = endpoint.strip()
        if normalized in seen:
            continue
        seen.add(normalized)
        ordered.append(normalized)

    priority_map = _KIND_PRIORITY_DOCKER if in_docker else _KIND_PRIORITY_HOST
    ordered.sort(key=lambda ep: _endpoint_sort_key(ep, priority_map))
    return ordered


def tcp_target_from_endpoint(endpoint: str) -> TcpTarget | None:
    raw = (endpoint or "").strip()
    if not raw:
        return None

    if "://" in raw:
        parsed = urlparse(raw)
        host = parsed.hostname
        if not host:
            return None

        scheme = (parsed.scheme or "").lower()
        port = parsed.port
        if port is None:
            if scheme.startswith("postgres"):
                port = 5432
            elif scheme == "redis":
                port = 6379
            elif scheme == "http":
                port = 80
            elif scheme == "https":
                port = 443
            else:
                return None
        return TcpTarget(host=host, port=port)

    # Support "host:port" style without a scheme.
    if ":" in raw and raw.count(":") == 1 and "/" not in raw:
        host_part, port_part = raw.split(":", 1)
        host = host_part.strip()
        if not host:
            return None
        try:
            port = int(port_part.strip())
        except ValueError:
            return None
        return TcpTarget(host=host, port=port)

    return None


def probe_tcp_endpoint(endpoint: str, *, timeout_s: float) -> tuple[bool, str | None]:
    target = tcp_target_from_endpoint(endpoint)
    if target is None:
        return False, "invalid endpoint"

    try:
        with socket.create_connection((target.host, target.port), timeout=max(0.1, timeout_s)):
            return True, None
    except OSError as exc:
        return False, str(exc)
