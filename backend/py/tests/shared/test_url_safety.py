from __future__ import annotations

import ipaddress

import pytest

from crystalith.shared.config.models import UrlFetchSecuritySettings
from crystalith.shared.net import UrlSafetyError, validate_url_for_fetch


def _policy(**kwargs) -> UrlFetchSecuritySettings:
    return UrlFetchSecuritySettings(**kwargs)


@pytest.mark.asyncio
async def test_validate_url_for_fetch_blocks_userinfo():
    async def resolver(_host: str, _port: int):
        return ()

    with pytest.raises(UrlSafetyError):
        await validate_url_for_fetch(
            "http://user:pass@example.com/",
            policy=_policy(),
            resolver=resolver,  # pragma: no cover - not used
        )


@pytest.mark.asyncio
async def test_validate_url_for_fetch_blocks_localhost():
    async def resolver(_host: str, _port: int):
        return (ipaddress.ip_address("127.0.0.1"),)

    with pytest.raises(UrlSafetyError):
        await validate_url_for_fetch("http://localhost/", policy=_policy(), resolver=resolver)


@pytest.mark.asyncio
async def test_validate_url_for_fetch_blocks_private_ipv4_literals():
    for url in (
        "http://127.0.0.1/",
        "http://10.0.0.1/",
        "http://172.16.0.1/",
        "http://192.168.0.1/",
    ):
        with pytest.raises(UrlSafetyError):
            await validate_url_for_fetch(url, policy=_policy())


@pytest.mark.asyncio
async def test_validate_url_for_fetch_blocks_metadata_ipv4_literal_even_if_allowlisted():
    with pytest.raises(UrlSafetyError):
        await validate_url_for_fetch(
            "http://169.254.169.254/",
            policy=_policy(allowlist_cidrs=["169.254.0.0/16"]),
        )


@pytest.mark.asyncio
async def test_validate_url_for_fetch_blocks_ipv6_loopback_and_link_local_literals():
    for url in ("http://[::1]/", "http://[fe80::1]/"):
        with pytest.raises(UrlSafetyError):
            await validate_url_for_fetch(url, policy=_policy())


@pytest.mark.asyncio
async def test_validate_url_for_fetch_allowlists_hostname():
    async def resolver(_host: str, _port: int):
        return (ipaddress.ip_address("10.0.0.1"),)

    await validate_url_for_fetch(
        "http://internal.example/",
        policy=_policy(allowlist_hosts=["internal.example"]),
        resolver=resolver,
    )


@pytest.mark.asyncio
async def test_validate_url_for_fetch_allowlists_cidr_for_hostname():
    async def resolver(_host: str, _port: int):
        return (ipaddress.ip_address("10.1.2.3"),)

    await validate_url_for_fetch(
        "http://cidr.example/",
        policy=_policy(allowlist_cidrs=["10.0.0.0/8"]),
        resolver=resolver,
    )


@pytest.mark.asyncio
async def test_validate_url_for_fetch_allowlist_only_blocks_non_allowlisted_public_host():
    async def resolver(_host: str, _port: int):
        return (ipaddress.ip_address("1.1.1.1"),)

    with pytest.raises(UrlSafetyError):
        await validate_url_for_fetch(
            "https://example.com/",
            policy=_policy(allowlist_only=True, allowlist_domains=["allowed.example"]),
            resolver=resolver,
        )
