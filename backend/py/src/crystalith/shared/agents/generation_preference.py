from __future__ import annotations

from dataclasses import dataclass
from typing import Literal

from crystalith.shared.types import OutputType

GenerationPreference = Literal["quality", "speed"]


@dataclass(frozen=True, slots=True)
class GenerationTuning:
    """
    Default tuning knobs for a single (OutputType, preference) pair.

    This is used as a table-driven alternative to scattered heuristics so we can:
    - keep default behavior predictable
    - log effective knobs for regression tuning
    - override per OutputType without changing API shapes
    """

    top_k: int
    min_score: float
    agent_retries: int
    # Retrieval knobs
    multi_query: bool
    multi_query_seed_cap: int
    max_chunks_per_source: int
    token_budget_ratio: float


DEFAULT_TUNING = GenerationTuning(
    top_k=5,
    min_score=0.2,
    agent_retries=2,
    multi_query=False,
    multi_query_seed_cap=2,
    max_chunks_per_source=2,
    token_budget_ratio=0.65,
)
QUALITY_TUNING = GenerationTuning(
    top_k=8,
    min_score=0.15,
    agent_retries=3,
    multi_query=True,
    multi_query_seed_cap=2,
    max_chunks_per_source=3,
    token_budget_ratio=0.75,
)
SPEED_TUNING = GenerationTuning(
    top_k=4,
    min_score=0.25,
    agent_retries=1,
    multi_query=False,
    # Seed cap still matters when CRYSTALITH_RETRIEVAL_MULTI_QUERY forces multi-query on.
    multi_query_seed_cap=2,
    max_chunks_per_source=2,
    token_budget_ratio=0.55,
)

# Per-output-type overrides.
#
# This replaces the older "tool vs non-tool" heuristic with a more fine-grained table
# so we can tune based on real logs (e.g., query_count, embed_ms, search_ms, total_ms).
#
# Keep the values conservative: callers can always override top_k/min_score in requests.
QUALITY_TUNING_BY_OUTPUT_TYPE: dict[OutputType, GenerationTuning] = {
    # More context + more retries for complex, strict schemas.
    OutputType.SLIDES: GenerationTuning(
        top_k=12,
        min_score=0.1,
        agent_retries=4,
        multi_query=True,
        multi_query_seed_cap=3,
        max_chunks_per_source=2,
        token_budget_ratio=0.85,
    ),
    OutputType.GUIDE: GenerationTuning(
        top_k=11,
        min_score=0.1,
        agent_retries=4,
        multi_query=True,
        multi_query_seed_cap=2,
        max_chunks_per_source=3,
        token_budget_ratio=0.75,
    ),
    OutputType.BRIEFING: GenerationTuning(
        top_k=10,
        min_score=0.1,
        agent_retries=4,
        multi_query=True,
        multi_query_seed_cap=2,
        max_chunks_per_source=3,
        token_budget_ratio=0.75,
    ),
    # Medium complexity.
    OutputType.TIMELINE: GenerationTuning(
        top_k=10,
        min_score=0.1,
        agent_retries=3,
        multi_query=True,
        multi_query_seed_cap=2,
        max_chunks_per_source=3,
        token_budget_ratio=0.75,
    ),
    OutputType.FAQ: GenerationTuning(
        top_k=9,
        min_score=0.12,
        agent_retries=3,
        multi_query=True,
        multi_query_seed_cap=2,
        max_chunks_per_source=3,
        token_budget_ratio=0.75,
    ),
    OutputType.QUIZ: GenerationTuning(
        top_k=9,
        min_score=0.12,
        agent_retries=3,
        multi_query=True,
        multi_query_seed_cap=2,
        max_chunks_per_source=3,
        token_budget_ratio=0.75,
    ),
    OutputType.MINDMAP: GenerationTuning(
        top_k=9,
        min_score=0.12,
        agent_retries=3,
        multi_query=True,
        multi_query_seed_cap=2,
        max_chunks_per_source=3,
        token_budget_ratio=0.75,
    ),
}

SPEED_TUNING_BY_OUTPUT_TYPE: dict[OutputType, GenerationTuning] = {
    # Keep speed mode practical for larger outputs while staying faster than quality.
    OutputType.SLIDES: GenerationTuning(
        top_k=6,
        min_score=0.22,
        agent_retries=2,
        multi_query=False,
        multi_query_seed_cap=2,
        max_chunks_per_source=2,
        token_budget_ratio=0.65,
    ),
    OutputType.GUIDE: GenerationTuning(
        top_k=5,
        min_score=0.22,
        agent_retries=2,
        multi_query=False,
        multi_query_seed_cap=2,
        max_chunks_per_source=2,
        token_budget_ratio=0.55,
    ),
    OutputType.BRIEFING: GenerationTuning(
        top_k=5,
        min_score=0.22,
        agent_retries=1,
        multi_query=False,
        multi_query_seed_cap=2,
        max_chunks_per_source=2,
        token_budget_ratio=0.55,
    ),
    OutputType.TIMELINE: GenerationTuning(
        top_k=5,
        min_score=0.22,
        agent_retries=1,
        multi_query=False,
        multi_query_seed_cap=2,
        max_chunks_per_source=2,
        token_budget_ratio=0.55,
    ),
}


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

    tuned = QUALITY_TUNING_BY_OUTPUT_TYPE.get(output_type) if preference == "quality" else SPEED_TUNING_BY_OUTPUT_TYPE.get(output_type)
    return tuned if tuned is not None else base
