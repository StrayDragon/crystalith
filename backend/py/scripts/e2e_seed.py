from __future__ import annotations

import json
import os
import sys
import urllib.error
import urllib.request


def _request(method: str, url: str, payload: dict | None = None) -> object | None:
    data = None
    if payload is not None:
        data = json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(
        url,
        data=data,
        method=method,
        headers={"Content-Type": "application/json"},
    )
    try:
        with urllib.request.urlopen(req, timeout=10) as response:
            body = response.read()
            if not body:
                return None
            return json.loads(body.decode("utf-8"))
    except urllib.error.HTTPError as exc:
        detail = exc.read().decode("utf-8")
        raise RuntimeError(f"{method} {url} failed: {exc.code} {detail}") from exc


def main() -> int:
    base_url = os.getenv("E2E_API_URL", "http://127.0.0.1:8032").rstrip("/")
    notebooks_url = f"{base_url}/v1/notebooks"

    notebooks = _request("GET", notebooks_url) or []
    if notebooks:
        print(f"E2E seed: notebooks already exist ({len(notebooks)}).")
        return 0

    name = os.getenv("E2E_NOTEBOOK_NAME", "E2E Notebook")
    created = _request("POST", notebooks_url, {"name": name})
    if not created:
        print("E2E seed: failed to create notebook.")
        return 1
    print(f"E2E seed: created notebook #{created.get('id')} ({created.get('name')}).")
    return 0


if __name__ == "__main__":
    sys.exit(main())
