"""Shared 模块 BDD 步骤的 fixtures。"""
from __future__ import annotations

import pytest


@pytest.fixture
def 向量存储():
    """创建内存向量存储实例。"""
    from crystalith.shared.vector_storage import InMemoryVectorStore

    return InMemoryVectorStore()


@pytest.fixture
def 缓存提供者():
    """创建内存缓存实例。"""
    from crystalith.shared.cache import InMemoryCache

    return InMemoryCache()


class _StubTokenCounter:
    """简易 token 计数器桩，不依赖网络下载 tiktoken 数据。"""

    def count_text(self, text: str) -> int:
        if not text:
            return 0
        return len(text.split())

    def count_messages(self, messages: list) -> int:
        return sum(self.count_text(message.content) for message in messages)

    def truncate_text(self, text: str, max_tokens: int) -> str:
        if not text or max_tokens <= 0:
            return ""
        tokens = text.split()
        if len(tokens) <= max_tokens:
            return text
        return " ".join(tokens[:max_tokens])


@pytest.fixture
def token计数器():
    """创建 token 计数器实例（桩实现，不依赖网络）。"""
    return _StubTokenCounter()
