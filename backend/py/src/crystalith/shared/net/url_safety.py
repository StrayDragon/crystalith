from __future__ import annotations

import asyncio
import ipaddress
import socket
from dataclasses import dataclass
from typing import Protocol
from collections.abc import Awaitable, Callable, Sequence
from urllib.parse import SplitResult, urlsplit


class UrlSafetyError(ValueError):
    """Raised when a URL fails SSRF safety validation."""


class UrlFetchSecurityPolicy(Protocol):
    @property
    def allowlist_hosts(self) -> Sequence[str]:
        ...

    @property
    def allowlist_domains(self) -> Sequence[str]:
        ...

    @property
    def allowlist_cidrs(self) -> Sequence[str]:
        ...

    @property
    def allowlist_only(self) -> bool:
        ...


type IPAddress = ipaddress.IPv4Address | ipaddress.IPv6Address
UrlFetchHostResolver = Callable[[str, int], Awaitable[Sequence[IPAddress]]]


@dataclass(frozen=True)
class _Allowlist:
    hosts: frozenset[str]
    domains: tuple[str, ...]
    cidrs: tuple[ipaddress._BaseNetwork, ...]
    allowlist_only: bool

    @classmethod
    def from_policy(cls, policy: UrlFetchSecurityPolicy) -> _Allowlist:
        domains = tuple(_normalize_domain_suffix(d) for d in policy.allowlist_domains if d)
        hosts = frozenset(_normalize_host(h) for h in policy.allowlist_hosts if h)
        cidrs = tuple(ipaddress.ip_network(c, strict=False) for c in policy.allowlist_cidrs if c)
        return cls(
            hosts=hosts,
            domains=domains,
            cidrs=cidrs,
            allowlist_only=bool(policy.allowlist_only),
        )


_METADATA_IPV4 = ipaddress.ip_address("169.254.169.254")


def _normalize_host(value: str) -> str:
    host = value.strip().lower().rstrip(".")
    if host.startswith("."):
        host = host[1:]
    return host


def _normalize_domain_suffix(value: str) -> str:
    suffix = value.strip().lower().rstrip(".")
    if suffix.startswith("."):
        suffix = suffix[1:]
    return suffix


def _host_matches_allowlist(hostname: str, allowlist: _Allowlist) -> bool:
    host = _normalize_host(hostname)
    if host in allowlist.hosts:
        return True
    for suffix in allowlist.domains:
        if host == suffix or host.endswith(f".{suffix}"):
            return True
    return False


def _ip_matches_allowlist(ip: ipaddress._BaseAddress, allowlist: _Allowlist) -> bool:
    for net in allowlist.cidrs:
        if ip in net:
            return True
    return False


def _is_blocked_ip(ip: IPAddress) -> bool:
    if ip == _METADATA_IPV4:
        return True
    # Safe-by-default SSRF denylist.
    return bool(ip.is_loopback or ip.is_link_local or ip.is_private or ip.is_unspecified)


def _parse_url(url: str) -> SplitResult:
    trimmed = url.strip()
    if not trimmed:
        raise UrlSafetyError("url must not be empty")
    if any(ch.isspace() for ch in trimmed):
        raise UrlSafetyError("url must not contain whitespace")
    parsed = urlsplit(trimmed)
    if parsed.scheme not in {"http", "https"}:
        raise UrlSafetyError("url must use http or https")
    if not parsed.hostname:
        raise UrlSafetyError("url must include a hostname")
    if parsed.username or parsed.password:
        raise UrlSafetyError("url must not include userinfo (username/password)")
    try:
        port = parsed.port
    except ValueError as exc:  # invalid port
        raise UrlSafetyError("url has an invalid port") from exc
    if port is not None and (port <= 0 or port > 65535):
        raise UrlSafetyError("url has an invalid port")
    return parsed


async def _default_resolve(hostname: str, port: int) -> Sequence[IPAddress]:
    loop = asyncio.get_running_loop()
    infos = await loop.getaddrinfo(hostname, port, type=socket.SOCK_STREAM)
    resolved: set[IPAddress] = set()
    for _family, _socktype, _proto, _canonname, sockaddr in infos:
        ip_str = sockaddr[0]
        try:
            resolved.add(ipaddress.ip_address(ip_str))
        except ValueError:
            continue
    return tuple(resolved)


async def validate_url_for_fetch(
    url: str,
    *,
    policy: UrlFetchSecurityPolicy,
    resolver: UrlFetchHostResolver | None = None,
) -> None:
    """
    Validate a user-provided URL for safe server-side fetching (SSRF protection).

    Raises:
        UrlSafetyError: if the URL is unsafe or disallowed by policy.
    """
    parsed = _parse_url(url)
    hostname = _normalize_host(parsed.hostname or "")

    allowlist = _Allowlist.from_policy(policy)

    port = parsed.port or (443 if parsed.scheme == "https" else 80)

    try:
        ip_literal = ipaddress.ip_address(hostname)
    except ValueError:
        ip_literal = None

    if ip_literal is not None:
        if ip_literal == _METADATA_IPV4:
            raise UrlSafetyError("url resolves to blocked metadata IP")
        if _ip_matches_allowlist(ip_literal, allowlist) or _host_matches_allowlist(hostname, allowlist):
            return
        if allowlist.allowlist_only:
            raise UrlSafetyError("url host is not allowlisted")
        if _is_blocked_ip(ip_literal):
            raise UrlSafetyError("url resolves to a blocked IP range")
        return

    if _host_matches_allowlist(hostname, allowlist):
        # Host allowlisted: still block metadata IP if it appears in resolution.
        try:
            resolved = await (resolver or _default_resolve)(hostname, port)
        except Exception as exc:
            raise UrlSafetyError("hostname resolution failed") from exc
        for ip in resolved:
            if ip == _METADATA_IPV4:
                raise UrlSafetyError("url resolves to blocked metadata IP")
        return

    try:
        resolved = await (resolver or _default_resolve)(hostname, port)
    except Exception as exc:
        raise UrlSafetyError("hostname resolution failed") from exc
    if not resolved:
        raise UrlSafetyError("hostname did not resolve")

    for ip in resolved:
        if ip == _METADATA_IPV4:
            raise UrlSafetyError("url resolves to blocked metadata IP")
        if _ip_matches_allowlist(ip, allowlist):
            continue
        if allowlist.allowlist_only:
            raise UrlSafetyError("url host is not allowlisted")
        if _is_blocked_ip(ip):
            raise UrlSafetyError("url resolves to a blocked IP range")
