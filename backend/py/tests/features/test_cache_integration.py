from __future__ import annotations

import fnmatch

import pytest

from crystalith.shared.deps import get_cache_provider


class _SpyCache:
    def __init__(self) -> None:
        self.data: dict[str, object] = {}
        self.get_calls: list[str] = []
        self.set_calls: list[str] = []
        self.delete_calls: list[str] = []
        self.invalidate_calls: list[str] = []

    async def get(self, key: str):  # noqa: ANN001
        self.get_calls.append(key)
        return self.data.get(key)

    async def set(self, key: str, value, *, ttl=None):  # noqa: ANN001
        self.set_calls.append(key)
        self.data[key] = value

    async def delete(self, key: str) -> None:
        self.delete_calls.append(key)
        self.data.pop(key, None)

    async def invalidate_pattern(self, pattern: str) -> int:
        self.invalidate_calls.append(pattern)
        keys = [key for key in list(self.data.keys()) if fnmatch.fnmatch(key, pattern)]
        for key in keys:
            self.data.pop(key, None)
        return len(keys)


@pytest.mark.asyncio
async def test_source_list_and_chunks_are_cached_and_invalidated(client, app) -> None:
    cache = _SpyCache()
    app.dependency_overrides[get_cache_provider] = lambda: cache  # type: ignore[assignment]

    try:
        notebook_resp = await client.post("/v1/notebooks", json={"name": "Cache Notebook"})
        assert notebook_resp.status_code == 201
        notebook_id = notebook_resp.json()["id"]

        files = {"file": ("note.txt", b"Hello world", "text/plain")}
        create_resp = await client.post(
            f"/v1/notebooks/{notebook_id}/sources",
            files=files,
        )
        assert create_resp.status_code == 201
        source_id = create_resp.json()["id"]

        list_url = f"/v1/notebooks/{notebook_id}/sources"

        list_resp1 = await client.get(list_url)
        assert list_resp1.status_code == 200
        list_resp2 = await client.get(list_url)
        assert list_resp2.status_code == 200
        assert list_resp2.json() == list_resp1.json()

        list_cache_sets = [k for k in cache.set_calls if k.startswith(f"notebook:{notebook_id}:sources:list:")]
        assert len(list_cache_sets) == 1

        chunks_url = f"/v1/notebooks/{notebook_id}/sources/{source_id}/chunks"
        chunks_resp1 = await client.get(chunks_url)
        assert chunks_resp1.status_code == 200
        chunks_resp2 = await client.get(chunks_url)
        assert chunks_resp2.status_code == 200
        assert chunks_resp2.json() == chunks_resp1.json()

        chunks_cache_sets = [k for k in cache.set_calls if k == f"notebook:{notebook_id}:sources:{source_id}:chunks"]
        assert len(chunks_cache_sets) == 1

        delete_resp = await client.delete(f"/v1/notebooks/{notebook_id}/sources/{source_id}")
        assert delete_resp.status_code == 204
        assert f"notebook:{notebook_id}:sources:*" in cache.invalidate_calls

        list_resp3 = await client.get(list_url)
        assert list_resp3.status_code == 200
        assert list_resp3.json() == []

        list_cache_sets = [k for k in cache.set_calls if k.startswith(f"notebook:{notebook_id}:sources:list:")]
        assert len(list_cache_sets) == 2
    finally:
        app.dependency_overrides.pop(get_cache_provider, None)
