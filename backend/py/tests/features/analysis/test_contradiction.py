from __future__ import annotations

import asyncio

import pytest

from crystalith.features.analysis.contradiction import detect_contradictions
from crystalith.features.analysis.types import Relation


class _ChatStub:
    provider = "test"
    model = "stub"

    def __init__(self) -> None:
        self.current = 0
        self.max_seen = 0

    async def chat(self, messages):
        self.current += 1
        self.max_seen = max(self.max_seen, self.current)
        await asyncio.sleep(0.01)
        self.current -= 1
        return "yes"

    def chat_stream(self, messages):
        async def _gen():
            yield await self.chat(messages)

        return _gen()


@pytest.mark.asyncio
async def test_detect_contradictions_uses_concurrency_limit() -> None:
    relations = [
        Relation(source_chunk_id=i, target_chunk_id=i + 100, relation_type="similar", score=0.8)
        for i in range(10)
    ]
    chunk_texts = {i: f"left-{i}" for i in range(10)}
    chunk_texts.update({i + 100: f"right-{i}" for i in range(10)})
    chat = _ChatStub()

    contradictions = await detect_contradictions(
        relations,
        chunk_texts,
        chat,
        max_checks=10,
        concurrency_limit=3,
    )

    assert len(contradictions) == 10
    assert chat.max_seen <= 3
