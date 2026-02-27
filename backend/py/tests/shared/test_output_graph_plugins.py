from __future__ import annotations

from typing import Any

import pytest
from pydantic import BaseModel

from crystalith.shared.agents.output_graph import DEFAULT_PROMPTS, GenerateOutput, OutputGraphState, OUTPUT_SCHEMAS
from crystalith.shared.types import OutputType


class _DummyCtx:
    def __init__(self, state: OutputGraphState, deps: Any) -> None:
        self.state = state
        self.deps = deps


class _PluginSchema(BaseModel):
    value: str


class _Plugin:
    output_type = "QUIZ"
    schema = _PluginSchema
    default_prompt = "custom plugin prompt"


class _DummyPlugins:
    def __init__(self, plugin: Any | None) -> None:
        self.output_types = {}
        if plugin is not None:
            self.output_types[plugin.output_type] = plugin


@pytest.mark.asyncio
async def test_generate_output_prefers_plugin_schema_and_prompt(monkeypatch: pytest.MonkeyPatch) -> None:
    import crystalith.shared.agents.output_graph as output_graph_mod

    captured: dict[str, Any] = {}

    class _StubAgent:
        def __init__(self, model, *, output_type, deps_type, system_prompt, retries):  # noqa: ANN001
            captured["schema"] = output_type

        async def run(self, user_prompt: str, deps: Any):  # noqa: ANN001
            captured["user_prompt"] = user_prompt

            class _Out:
                def model_dump(self) -> dict[str, Any]:
                    return {"value": "ok"}

            return type("Result", (), {"output": _Out()})()

    # Mock reason: validate schema/prompt selection without external model execution.
    monkeypatch.setattr(output_graph_mod, "Agent", _StubAgent)

    state = OutputGraphState(
        notebook_id=1,
        output_type=OutputType.QUIZ,
        prompt="",
    )

    deps = type(
        "Deps",
        (),
        {
            "plugins": _DummyPlugins(_Plugin()),
            "settings": object(),
            "model": object(),
            "limiters": None,
        },
    )()

    await GenerateOutput().run(_DummyCtx(state, deps))

    assert captured["schema"] is _PluginSchema
    assert _Plugin.default_prompt in captured["user_prompt"]


@pytest.mark.asyncio
async def test_generate_output_falls_back_to_core_schema_and_prompt(monkeypatch: pytest.MonkeyPatch) -> None:
    import crystalith.shared.agents.output_graph as output_graph_mod

    captured: dict[str, Any] = {}

    class _StubAgent:
        def __init__(self, model, *, output_type, deps_type, system_prompt, retries):  # noqa: ANN001
            captured["schema"] = output_type

        async def run(self, user_prompt: str, deps: Any):  # noqa: ANN001
            captured["user_prompt"] = user_prompt

            class _Out:
                def model_dump(self) -> dict[str, Any]:
                    return {"value": "ok"}

            return type("Result", (), {"output": _Out()})()

    # Mock reason: validate fallback schema/prompt selection without external model execution.
    monkeypatch.setattr(output_graph_mod, "Agent", _StubAgent)

    state = OutputGraphState(
        notebook_id=1,
        output_type=OutputType.QUIZ,
        prompt="",
    )

    deps = type(
        "Deps",
        (),
        {
            "plugins": _DummyPlugins(None),
            "settings": object(),
            "model": object(),
            "limiters": None,
        },
    )()

    await GenerateOutput().run(_DummyCtx(state, deps))

    assert captured["schema"] is OUTPUT_SCHEMAS[OutputType.QUIZ]
    assert DEFAULT_PROMPTS[OutputType.QUIZ] in captured["user_prompt"]
