from __future__ import annotations

from crystalith.shared.net.url_normalize import canonicalize_url_for_dedup


def test_canonicalize_url_for_dedup_normalizes_host_and_path() -> None:
    assert canonicalize_url_for_dedup("https://Example.COM") == "https://example.com/"
    assert canonicalize_url_for_dedup("https://example.com/path/") == "https://example.com/path"
    assert canonicalize_url_for_dedup("https://example.com./") == "https://example.com/"


def test_canonicalize_url_for_dedup_strips_default_ports_and_fragments() -> None:
    assert canonicalize_url_for_dedup("http://example.com:80/a#section") == "http://example.com/a"
    assert canonicalize_url_for_dedup("https://example.com:443/a#section") == "https://example.com/a"
    assert canonicalize_url_for_dedup("https://example.com:444/a") == "https://example.com:444/a"


def test_canonicalize_url_for_dedup_filters_tracking_params_and_sorts_query() -> None:
    url = "https://example.com/path?utm_source=x&b=2&a=1&gclid=zzz&ref=abc"
    assert canonicalize_url_for_dedup(url) == "https://example.com/path?a=1&b=2"
