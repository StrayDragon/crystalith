from urllib.parse import parse_qs, parse_qsl, urlencode, urlparse, urlunparse


def url_update_params(url: str, params: dict[str, str]) -> str:
    url_parts = list(urlparse(url))
    query = dict(parse_qsl(url_parts[4]))
    query.update(params)
    url_parts[4] = urlencode(query)
    return urlunparse(url_parts)


def extract_query_param(url_like: str) -> dict[str, list[str]]:
    parsed_url = urlparse(url_like)
    query_str = parsed_url.query
    return parse_qs(query_str)
