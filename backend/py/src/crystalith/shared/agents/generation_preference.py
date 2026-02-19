from __future__ import annotations

from dataclasses import dataclass
from typing import Literal


GenerationPreference = Literal["quality", "speed"]


@dataclass(frozen=True, slots=True)
class GenerationTuning:
    top_k: int
    min_score: float
    agent_retries: int


DEFAULT_TUNING = GenerationTuning(top_k=5, min_score=0.2, agent_retries=2)
QUALITY_TUNING = GenerationTuning(top_k=8, min_score=0.15, agent_retries=3)
SPEED_TUNING = GenerationTuning(top_k=4, min_score=0.25, agent_retries=1)


def tuning_for_preference(preference: GenerationPreference | None) -> GenerationTuning:
    if preference == "quality":
        return QUALITY_TUNING
    if preference == "speed":
        return SPEED_TUNING
    return DEFAULT_TUNING
