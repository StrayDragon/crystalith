from __future__ import annotations

from dataclasses import dataclass
from typing import Literal

from crystalith.shared.types import OutputType


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


def tuning_for_request(output_type: OutputType, preference: GenerationPreference | None) -> GenerationTuning:
    base = tuning_for_preference(preference)
    if preference is None:
        return base

    try:
        is_tool = bool(getattr(output_type, "x_meta", None).is_tool)
    except Exception:  # noqa: BLE001 - best-effort
        is_tool = False

    if not is_tool:
        return base

    if preference == "quality":
        return GenerationTuning(
            top_k=min(20, int(base.top_k) + 2),
            min_score=max(0.0, float(base.min_score) - 0.05),
            agent_retries=int(base.agent_retries),
        )

    return base
