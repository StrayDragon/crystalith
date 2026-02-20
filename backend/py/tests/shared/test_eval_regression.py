from __future__ import annotations

import json

import pytest

from crystalith.shared.eval.regression import (
    check_constraints,
    load_dataset,
    percentile,
    validate_citations,
    validate_mapped_citations,
)


def test_percentile_interpolates() -> None:
    assert percentile([1, 2, 3, 4], 50) == 2.5
    assert percentile([1, 2, 3, 4], 0) == 1
    assert percentile([1, 2, 3, 4], 100) == 4


def test_validate_citations() -> None:
    assert validate_citations({"citations": [1, 2]}, citations_count=2) == (True, True)
    assert validate_citations({"citations": []}, citations_count=2) == (False, False)
    assert validate_citations({"citations": [3]}, citations_count=2) == (False, True)


def test_validate_mapped_citations() -> None:
    payload = {
        "items": [
            {
                "text": "x",
                "citations": [{"source_id": 1, "chunk_id": 2}],
            }
        ]
    }
    assert validate_mapped_citations(payload, allowed_chunk_ids={2}, allowed_source_ids={1}) == (True, True)
    assert validate_mapped_citations(payload, allowed_chunk_ids={999}, allowed_source_ids={1}) == (False, True)


def test_check_constraints_defaults_require_non_fallback_and_citations() -> None:
    passed, failures = check_constraints(
        constraints={},
        fallback=False,
        citations_valid=True,
        has_citations=True,
        query_count=1,
    )
    assert passed is True
    assert failures == []

    passed, failures = check_constraints(
        constraints={},
        fallback=True,
        citations_valid=True,
        has_citations=True,
        query_count=1,
    )
    assert passed is False
    assert "fallback" in failures

    passed, failures = check_constraints(
        constraints={},
        fallback=False,
        citations_valid=False,
        has_citations=True,
        query_count=1,
    )
    assert passed is False
    assert "citations" in failures


def test_load_dataset_parses_samples(tmp_path) -> None:
    dataset = {
        "version": 1,
        "samples": [
            {
                "id": "s1",
                "output_type": "BULLETS",
                "preference": "quality",
                "prompt": "Summarize.",
                "constraints": {"min_query_count": 2},
            }
        ],
    }
    path = tmp_path / "dataset.json"
    path.write_text(json.dumps(dataset), encoding="utf-8")

    samples = load_dataset(path)
    assert len(samples) == 1
    assert samples[0].id == "s1"
    assert samples[0].output_type.value == "BULLETS"
    assert samples[0].preference == "quality"
    assert samples[0].prompt == "Summarize."
    assert samples[0].constraints["min_query_count"] == 2


def test_load_dataset_rejects_missing_prompt(tmp_path) -> None:
    dataset = {"version": 1, "samples": [{"id": "s1", "output_type": "BULLETS"}]}
    path = tmp_path / "dataset.json"
    path.write_text(json.dumps(dataset), encoding="utf-8")

    with pytest.raises(ValueError, match="missing prompt"):
        load_dataset(path)
