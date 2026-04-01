from __future__ import annotations

from crystalith.shared.agents.generation_preference import tuning_for_preference, tuning_for_request
from crystalith.shared.types import OutputType


def test_tuning_for_request_quality_uses_output_type_overrides() -> None:
    tuned = tuning_for_request(OutputType.SLIDES, "quality")
    assert tuned.top_k == 12
    assert tuned.min_score == 0.1
    assert tuned.agent_retries == 4
    assert tuned.multi_query is True
    assert tuned.multi_query_seed_cap == 3
    assert tuned.max_chunks_per_source == 2
    assert tuned.token_budget_ratio == 0.85

    tuned = tuning_for_request(OutputType.QUIZ, "quality")
    assert tuned.top_k == 9
    assert tuned.min_score == 0.12
    assert tuned.agent_retries == 3
    assert tuned.multi_query is True
    assert tuned.multi_query_seed_cap == 2
    assert tuned.max_chunks_per_source == 3
    assert tuned.token_budget_ratio == 0.75


def test_tuning_for_request_non_tool_matches_base() -> None:
    base = tuning_for_preference("quality")
    tuned = tuning_for_request(OutputType.PARAGRAPH, "quality")
    assert tuned == base


def test_tuning_for_request_speed_uses_output_type_overrides_when_present() -> None:
    tuned = tuning_for_request(OutputType.SLIDES, "speed")
    assert tuned.top_k == 6
    assert tuned.min_score == 0.22
    assert tuned.agent_retries == 2
    assert tuned.multi_query is False
    assert tuned.multi_query_seed_cap == 2
    assert tuned.max_chunks_per_source == 2
    assert tuned.token_budget_ratio == 0.65

    base = tuning_for_preference("speed")
    tuned = tuning_for_request(OutputType.BULLETS, "speed")
    assert tuned == base


def test_tuning_for_request_none_matches_default() -> None:
    base = tuning_for_preference(None)
    tuned = tuning_for_request(OutputType.GUIDE, None)
    assert tuned == base
