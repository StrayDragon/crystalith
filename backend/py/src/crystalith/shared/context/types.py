from __future__ import annotations

from dataclasses import dataclass
from typing import Literal

CompressionStrategy = Literal["summarize", "truncate"]
ContextPriority = Literal["system", "recent", "retrieval", "history"]


@dataclass(frozen=True, slots=True)
class ContextStats:
    total_tokens: int
    system_tokens: int
    history_tokens: int
    retrieval_tokens: int
    query_tokens: int
    max_tokens: int
    compressed: bool
