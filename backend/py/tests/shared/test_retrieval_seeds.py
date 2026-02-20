from __future__ import annotations

import pytest

from crystalith.shared.retrieval.context import _build_query_seeds, _select_query_seeds
from crystalith.shared.types import OutputType


@pytest.mark.parametrize(
    ("output_type", "expected_substrings"),
    [
        (OutputType.TIMELINE, ("日期", "事件")),
        (OutputType.QUIZ, ("定义", "概念")),
        (OutputType.BRIEFING, ("风险", "建议")),
        (OutputType.SLIDES, ("幻灯片",)),
    ],
)
def test_query_seeds_include_output_type_hints_and_respect_cap(
    output_type: OutputType,
    expected_substrings: tuple[str, ...],
) -> None:
    seeds = _build_query_seeds("seed", output_type)
    selected = _select_query_seeds(seeds, seed_cap=2)

    assert len(selected) == 2
    assert any("Output type:" in item for item in selected)

    joined = "\n\n".join(selected)
    for substring in expected_substrings:
        assert substring in joined
