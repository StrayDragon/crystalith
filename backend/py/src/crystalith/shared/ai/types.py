from __future__ import annotations

from dataclasses import dataclass
from typing import Literal
ProviderType = str
ChatRole = Literal["system", "user", "assistant"]


@dataclass(frozen=True, slots=True)
class ChatMessage:
    role: ChatRole
    content: str
