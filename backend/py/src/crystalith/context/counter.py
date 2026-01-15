from __future__ import annotations

from functools import lru_cache

import tiktoken


@lru_cache(maxsize=8)
def _resolve_encoding(model: str | None, fallback: str) -> tiktoken.Encoding:
    if model:
        try:
            return tiktoken.encoding_for_model(model)
        except KeyError:
            pass
    return tiktoken.get_encoding(fallback)


class TokenCounter:
    def __init__(self, model: str | None, fallback_encoding: str = "cl100k_base") -> None:
        self._encoding = _resolve_encoding(model, fallback_encoding)

    def count_text(self, text: str) -> int:
        if not text:
            return 0
        return len(self._encoding.encode(text))

    def count_messages(self, messages: list) -> int:
        return sum(self.count_text(message.content) for message in messages)

    def truncate_text(self, text: str, max_tokens: int) -> str:
        if not text or max_tokens <= 0:
            return ""
        tokens = self._encoding.encode(text)
        if len(tokens) <= max_tokens:
            return text
        return self._encoding.decode(tokens[:max_tokens])
