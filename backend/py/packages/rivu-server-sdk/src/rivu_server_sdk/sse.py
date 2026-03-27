from __future__ import annotations

import json
from typing import Any


def encode_sse_event(*, seq: int, event: Any) -> str:
    """Encode a single AG-UI event as SSE with `id: seq`.

    The returned string ends with a blank line (SSE frame delimiter).
    """
    if not isinstance(seq, int) or seq <= 0:
        raise ValueError("seq must be a positive int")
    data = json.dumps(event, ensure_ascii=False, separators=(",", ":"))
    return f"id: {seq}\n" f"data: {data}\n\n"
