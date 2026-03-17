from __future__ import annotations

from typing import Any, cast

import pytest
from pydantic import BaseModel
from pydantic_graph import GraphRunContext

from crystalith.shared.agents.deps import StudioDeps
from crystalith.shared.agents.output_graph import DEFAULT_PROMPTS, OUTPUT_SCHEMAS, GenerateOutput, OutputGraphState
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
        def __init__(self, model, *, output_type, deps_type, system_prompt, retries):
            captured["schema"] = output_type

        async def run(self, user_prompt: str, deps: Any):
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

    ctx = cast(GraphRunContext[OutputGraphState, StudioDeps], _DummyCtx(state, deps))
    await GenerateOutput().run(ctx)

    assert captured["schema"] is _PluginSchema
    assert _Plugin.default_prompt in captured["user_prompt"]


@pytest.mark.asyncio
async def test_generate_output_falls_back_to_core_schema_and_prompt(monkeypatch: pytest.MonkeyPatch) -> None:
    import crystalith.shared.agents.output_graph as output_graph_mod

    captured: dict[str, Any] = {}

    class _StubAgent:
        def __init__(self, model, *, output_type, deps_type, system_prompt, retries):
            captured["schema"] = output_type

        async def run(self, user_prompt: str, deps: Any):
            captured["user_prompt"] = user_prompt

            class _Out:
                def model_dump(self) -> dict[str, Any]:
                    return {"value": "ok"}

            return type("Result", (), {"output": _Out()})()

    # Mock reason: validate fallback schema/prompt selection without external model execution.
    monkeypatch.setattr(output_graph_mod, "Agent", _StubAgent)

    state = OutputGraphState(
        notebook_id=1,
        output_type=OutputType.PARAGRAPH,
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

    ctx = cast(GraphRunContext[OutputGraphState, StudioDeps], _DummyCtx(state, deps))
    await GenerateOutput().run(ctx)

    assert captured["schema"] is OUTPUT_SCHEMAS[OutputType.PARAGRAPH]
    assert DEFAULT_PROMPTS[OutputType.PARAGRAPH] in captured["user_prompt"]


@pytest.mark.asyncio
async def test_generate_output_requires_plugin_for_tool_output_types() -> None:
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

    ctx = cast(GraphRunContext[OutputGraphState, StudioDeps], _DummyCtx(state, deps))
    with pytest.raises(ValueError, match="install/enable"):
        await GenerateOutput().run(ctx)
