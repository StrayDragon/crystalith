from __future__ import annotations

import json
from dataclasses import dataclass, field
from pathlib import Path
from typing import cast

from crystalith.shared.agents.generation_preference import GenerationPreference
from crystalith.shared.types import OutputType


@dataclass(frozen=True, slots=True)
class EvalSample:
    id: str
    prompt: str
    output_type: OutputType
    preference: GenerationPreference | None = None
    constraints: dict[str, object] = field(default_factory=dict)


def load_dataset(path: Path) -> list[EvalSample]:
    raw = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(raw, dict):
        raise ValueError("Dataset must be a JSON object")

    samples_raw = raw.get("samples")
    if not isinstance(samples_raw, list):
        raise ValueError("Dataset must contain a 'samples' list")

    samples: list[EvalSample] = []
    for idx, item in enumerate(samples_raw):
        if not isinstance(item, dict):
            raise ValueError(f"Invalid sample at index {idx}: expected object")

        sample_id = str(item.get("id") or f"sample-{idx + 1}")
        prompt = str(item.get("prompt") or "").strip()
        if not prompt:
            raise ValueError(f"Sample {sample_id} is missing prompt")

        output_type_value = item.get("output_type")
        if not isinstance(output_type_value, str) or not output_type_value.strip():
            raise ValueError(f"Sample {sample_id} is missing output_type")
        output_type = OutputType(output_type_value.strip())

        preference_value = item.get("preference")
        preference: GenerationPreference | None
        if preference_value is None:
            preference = None
        else:
            normalized = str(preference_value).strip().lower()
            if normalized not in {"quality", "speed"}:
                raise ValueError(f"Sample {sample_id} has invalid preference: {preference_value!r}")
            preference = cast(GenerationPreference, normalized)

        constraints = item.get("constraints")
        if constraints is None:
            constraints = {}
        if not isinstance(constraints, dict):
            raise ValueError(f"Sample {sample_id} has invalid constraints (expected object)")

        samples.append(
            EvalSample(
                id=sample_id,
                prompt=prompt,
                output_type=output_type,
                preference=preference,
                constraints=dict(constraints),
            )
        )

    return samples


def percentile(values: list[float], pct: float) -> float:
    if not values:
        return 0.0

    samples = sorted(float(value) for value in values)
    if pct <= 0:
        return float(samples[0])
    if pct >= 100:
        return float(samples[-1])

    rank = (len(samples) - 1) * (float(pct) / 100.0)
    lower = int(rank)
    upper = min(lower + 1, len(samples) - 1)
    weight = rank - lower
    if upper == lower:
        return float(samples[lower])
    return float(samples[lower] + (samples[upper] - samples[lower]) * weight)


def _collect_citation_indices(payload: object) -> list[int]:
    indices: list[int] = []

    if isinstance(payload, dict):
        for key, value in payload.items():
            if key == "citations":
                if isinstance(value, list):
                    for item in value:
                        try:
                            indices.append(int(item))
                        except (TypeError, ValueError):
                            continue
                continue
            indices.extend(_collect_citation_indices(value))
        return indices

    if isinstance(payload, list):
        for item in payload:
            indices.extend(_collect_citation_indices(item))
        return indices

    return indices


def validate_citations(payload: object, *, citations_count: int) -> tuple[bool, bool]:
    indices = _collect_citation_indices(payload)
    if not indices:
        return False, False
    if citations_count <= 0:
        return False, True
    return all(1 <= index <= citations_count for index in indices), True


def _collect_citation_objects(payload: object) -> list[dict[str, object]]:
    citations: list[dict[str, object]] = []

    if isinstance(payload, dict):
        for key, value in payload.items():
            if key == "citations":
                if isinstance(value, list):
                    citations.extend([item for item in value if isinstance(item, dict)])
                continue
            citations.extend(_collect_citation_objects(value))
        return citations

    if isinstance(payload, list):
        for item in payload:
            citations.extend(_collect_citation_objects(item))
        return citations

    return citations


def validate_mapped_citations(
    payload: object,
    *,
    allowed_chunk_ids: set[int] | None = None,
    allowed_source_ids: set[int] | None = None,
) -> tuple[bool, bool]:
    citations = _collect_citation_objects(payload)
    if not citations:
        return False, False

    for item in citations:
        source_id = item.get("source_id")
        chunk_id = item.get("chunk_id")
        if not isinstance(source_id, int) or not isinstance(chunk_id, int):
            return False, True
        if allowed_chunk_ids is not None and chunk_id not in allowed_chunk_ids:
            return False, True
        if allowed_source_ids is not None and source_id not in allowed_source_ids:
            return False, True

    return True, True


def check_constraints(
    *,
    constraints: dict[str, object],
    fallback: bool,
    citations_valid: bool,
    has_citations: bool,
    query_count: int,
) -> tuple[bool, list[str]]:
    failures: list[str] = []

    require_non_fallback = bool(constraints.get("require_non_fallback", True))
    if require_non_fallback and fallback:
        failures.append("fallback")

    require_citations = bool(constraints.get("require_citations", True))
    if require_citations and not (citations_valid and has_citations):
        failures.append("citations")

    min_query_count = constraints.get("min_query_count")
    if min_query_count is not None:
        minimum = 0
        if isinstance(min_query_count, bool):
            minimum = 0
        elif isinstance(min_query_count, (int, float, str)):
            try:
                minimum = int(min_query_count)
            except ValueError:
                minimum = 0
        if query_count < minimum:
            failures.append("query_count")

    return not failures, failures
