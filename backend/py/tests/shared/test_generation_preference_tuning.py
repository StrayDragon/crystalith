from __future__ import annotations

from crystalith.shared.agents.generation_preference import tuning_for_preference, tuning_for_request
from crystalith.shared.types import OutputType


def test_tuning_for_request_tool_quality_adjusts_retrieval() -> None:
    base = tuning_for_preference("quality")
    tuned = tuning_for_request(OutputType.QUIZ, "quality")
    assert tuned.top_k >= base.top_k
    assert tuned.min_score <= base.min_score
    assert tuned.agent_retries == base.agent_retries


def test_tuning_for_request_non_tool_matches_base() -> None:
    base = tuning_for_preference("quality")
    tuned = tuning_for_request(OutputType.PARAGRAPH, "quality")
    assert tuned == base


def test_tuning_for_request_speed_matches_base_for_tool() -> None:
    base = tuning_for_preference("speed")
    tuned = tuning_for_request(OutputType.GUIDE, "speed")
    assert tuned == base


def test_tuning_for_request_none_matches_default() -> None:
    base = tuning_for_preference(None)
    tuned = tuning_for_request(OutputType.GUIDE, None)
    assert tuned == base
