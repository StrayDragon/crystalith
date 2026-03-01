from __future__ import annotations

import json
import re
from dataclasses import dataclass

from pydantic import BaseModel, Field, ValidationError


_PROMPT_DIRECTIVE_RE = re.compile(
    r"^/prompt:(?P<preset>[a-z0-9_-]{1,32})(?P<rest>.*)$",
    flags=re.IGNORECASE,
)


@dataclass(frozen=True, slots=True)
class PromptDirective:
    preset: str
    query: str


def parse_prompt_directive(question: str) -> PromptDirective | None:
    stripped = question.lstrip()
    if not stripped.lower().startswith("/prompt:"):
        return None
    match = _PROMPT_DIRECTIVE_RE.match(stripped)
    if match is None:
        raise ValueError("Invalid /prompt directive")
    preset = match.group("preset").lower()
    query = (match.group("rest") or "").strip()
    return PromptDirective(preset=preset, query=query)


class StatsChartItem(BaseModel):
    label: str = Field(..., min_length=1)
    value: float


class StatsChart(BaseModel):
    title: str = Field(..., min_length=1)
    unit: str | None = None
    items: list[StatsChartItem] = Field(..., min_length=1)


class StatsTable(BaseModel):
    columns: list[str] = Field(..., min_length=1)
    rows: list[list[str | int | float | None]] = Field(default_factory=list)


class StatsPresetOutput(BaseModel):
    fallback_markdown: str = Field(..., min_length=1)
    chart: StatsChart
    table: StatsTable | None = None


def parse_stats_preset_output(text: str) -> StatsPresetOutput | None:
    raw = text.strip()
    if not raw:
        return None
    try:
        payload = json.loads(raw)
    except json.JSONDecodeError:
        start = raw.find("{")
        end = raw.rfind("}")
        if start < 0 or end <= start:
            return None
        try:
            payload = json.loads(raw[start : end + 1])
        except json.JSONDecodeError:
            return None
    try:
        return StatsPresetOutput.model_validate(payload)
    except ValidationError:
        return None


STATS_SYSTEM_PROMPT = (
    "You are a research assistant. Answer ONLY using the provided sources. "
    "Return a SINGLE JSON object with keys: fallback_markdown, chart, table (optional). "
    "Do NOT wrap the JSON in code fences. Do NOT include any extra text before or after the JSON. "
    "fallback_markdown MUST be non-empty, human-readable, and SHOULD include inline citations like [1], [2]. "
    "chart MUST include: title (string), unit (optional string), items (array of {label, value:number}). "
    "table (optional) MUST include: columns (string[]), rows ((string|number|null)[][])."
)


@dataclass(frozen=True, slots=True)
class QAPreset:
    id: str
    description: str
    system_prompt: str


_PRESETS: dict[str, QAPreset] = {
    "stats": QAPreset(
        id="stats",
        description="Generate a structured stats summary (chart + optional table).",
        system_prompt=STATS_SYSTEM_PROMPT,
    )
}


def list_preset_ids() -> list[str]:
    return sorted(_PRESETS.keys())


def get_preset(preset_id: str) -> QAPreset | None:
    return _PRESETS.get(preset_id)


def stats_output_to_ui_envelope(output: StatsPresetOutput) -> dict[str, object]:
    parts: list[dict[str, object]] = [
        {
            "type": "component",
            "name": "AnswerCard",
            "id": "answer",
            "props": {"markdown": output.fallback_markdown},
        },
        {
            "type": "component",
            "name": "BarChartCard",
            "id": "chart",
            "props": {
                "title": output.chart.title,
                "unit": output.chart.unit,
                "items": [item.model_dump(mode="json") for item in output.chart.items],
            },
        },
    ]
    if output.table is not None:
        parts.append(
            {
                "type": "component",
                "name": "DataTableCard",
                "id": "table",
                "props": output.table.model_dump(mode="json"),
            }
        )
    parts.extend(
        [
            {
                "type": "tool_use",
                "id": "qa_export_markdown_preview",
                "name": "qa_export_markdown_preview",
                "input": {},
                "auto_execute": True,
            },
            {
                "type": "tool_use",
                "id": "qa_export_json_preview",
                "name": "qa_export_json_preview",
                "input": {},
                "requires_confirm": True,
            },
        ]
    )
    return {"schema": "crystalith.ui.message.v1", "parts": parts}
