from __future__ import annotations

from enum import StrEnum


class SuggestionType(StrEnum):
    FACTUAL = "factual"
    ANALYTICAL = "analytical"
    COMPARATIVE = "comparative"
    CREATIVE = "creative"
    DEEP_DIVE = "deep_dive"
