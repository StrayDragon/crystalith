from __future__ import annotations

from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit

_TRACKING_QUERY_KEYS = frozenset(
    {
        "gclid",
        "fbclid",
        "msclkid",
        "mc_cid",
        "mc_eid",
        "yclid",
        "igshid",
        "ref",
        "ref_src",
    }
)


def canonicalize_url_for_dedup(url: str) -> str:
    """
    Canonicalize a URL for deduplication.

    - lowercases scheme/host
    - removes fragments
    - removes default ports (80/443)
    - removes common tracking query params (utm_*, gclid, fbclid, ...)
    - sorts remaining query params for stability
    - normalizes empty path to "/"
    """
    parsed = urlsplit(url.strip())
    scheme = (parsed.scheme or "").lower()
    hostname = (parsed.hostname or "").lower().rstrip(".")

    port = parsed.port
    if port is not None and ((scheme == "http" and port == 80) or (scheme == "https" and port == 443)):
        port = None

    netloc = hostname
    if port is not None:
        netloc = f"{hostname}:{port}"

    path = parsed.path or "/"
    if path != "/" and path.endswith("/"):
        path = path.rstrip("/")

    filtered: list[tuple[str, str]] = []
    for key, value in parse_qsl(parsed.query, keep_blank_values=True):
        key_lower = key.lower()
        if key_lower.startswith("utm_") or key_lower in _TRACKING_QUERY_KEYS:
            continue
        filtered.append((key, value))

    filtered.sort(key=lambda pair: (pair[0], pair[1]))
    query = urlencode(filtered, doseq=True)

    return urlunsplit((scheme, netloc, path, query, ""))
