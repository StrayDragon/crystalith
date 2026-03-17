from __future__ import annotations

import json
import re
from copy import deepcopy
from dataclasses import dataclass
from typing import cast

from pydantic import BaseModel, Field, ValidationError
from rivu_server_sdk import mount_component_v1, set_component_v1
from rivu_server_sdk.json_patch import apply_json_patch

from crystalith.shared.json_types import JsonDict, JsonValue
from crystalith.shared.ui_state import build_default_shared_state

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


def _build_data_table_rows(table: StatsTable) -> list[JsonDict]:
    rows: list[JsonDict] = []
    for raw_row in table.rows:
        row: JsonDict = {}
        for index, column in enumerate(table.columns):
            value = raw_row[index] if index < len(raw_row) else None
            row[column] = cast(JsonValue, value)
        rows.append(row)
    return rows


def stats_output_to_ui_delta(
    output: StatsPresetOutput,
    *,
    message_id: int,
) -> list[JsonDict]:
    target_message_id = str(message_id)
    state = build_default_shared_state()
    delta: list[JsonDict] = []

    def apply(ops: list[JsonDict]) -> None:
        nonlocal state, delta
        state = cast(
            JsonDict,
            apply_json_patch(state, cast(list[dict[str, object]], deepcopy(ops))),
        )
        delta.extend(cast(list[JsonDict], deepcopy(ops)))

    summary_component_id = f"qa:{message_id}:summary"
    summary_component: JsonDict = {
        "type": "ReportSection",
        "schemaVersion": 1,
        "props": {
            "title": "统计摘要",
            "description": output.fallback_markdown,
        },
        "revision": 0,
        "mounts": [],
        "status": "ready",
    }
    apply(cast(list[JsonDict], set_component_v1(component_id=summary_component_id, component=summary_component)))
    apply(cast(list[JsonDict], mount_component_v1(component_id=summary_component_id, message_id=target_message_id, slot="inline", order=0)))

    chart_component_id = f"qa:{message_id}:chart"
    chart_component: JsonDict = {
        "type": "BarChart",
        "schemaVersion": 1,
        "props": {
            "title": output.chart.title,
            "unit": output.chart.unit,
            "items": [item.model_dump(mode="json") for item in output.chart.items],
        },
        "revision": 0,
        "mounts": [],
        "status": "ready",
    }
    apply(cast(list[JsonDict], set_component_v1(component_id=chart_component_id, component=chart_component)))
    apply(cast(list[JsonDict], mount_component_v1(component_id=chart_component_id, message_id=target_message_id, slot="inline", order=1)))

    if output.table is not None:
        table_component_id = f"qa:{message_id}:table"
        table_columns: list[JsonDict] = [
            {"key": column, "label": column}
            for column in output.table.columns
        ]
        table_component: JsonDict = {
            "type": "DataTable",
            "schemaVersion": 1,
            "props": {
                "caption": output.chart.title,
                "columns": cast(JsonValue, table_columns),
                "rows": cast(JsonValue, _build_data_table_rows(output.table)),
            },
            "revision": 0,
            "mounts": [],
            "status": "ready",
        }
        apply(
            cast(
                list[JsonDict],
                set_component_v1(
                    component_id=table_component_id,
                    component=table_component,
                ),
            )
        )
        apply(
            cast(
                list[JsonDict],
                mount_component_v1(
                    component_id=table_component_id,
                    message_id=target_message_id,
                    slot="inline",
                    order=2,
                ),
            )
        )

    return delta
