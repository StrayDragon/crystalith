from __future__ import annotations

from typing import Protocol

from .types import OutputContent


class OutputGenerator(Protocol):
    async def generate(self, context: str, prompt: str) -> OutputContent: ...
