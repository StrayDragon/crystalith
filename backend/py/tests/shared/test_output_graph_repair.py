from __future__ import annotations

from typing import Any, cast

import pytest
from pydantic_graph import GraphRunContext

from crystalith.shared.agents.deps import StudioDeps
from crystalith.shared.agents.output_graph import OutputGraphState, PostprocessOutput
from crystalith.shared.env import CRYSTALITH_OUTPUT_REPAIR
from crystalith.shared.schemas.citations import Citation
from crystalith.shared.types import OutputType


class _DummyCtx:
    def __init__(self, state: OutputGraphState, deps: Any) -> None:
        self.state = state
        self.deps = deps


@pytest.mark.asyncio
async def test_postprocess_output_runs_repair_when_enabled_and_quality(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    import crystalith.shared.agents.output_graph as output_graph_mod

    # Mock reason: env flag is the supported switch for enabling repair flow.
    monkeypatch.setenv(CRYSTALITH_OUTPUT_REPAIR, "1")
    called: dict[str, Any] = {"runs": 0}

    class _StubAgent:
        def __init__(self, model, *, output_type, deps_type, system_prompt, retries):
            called["schema"] = output_type

        async def run(self, user_prompt: str, deps: Any):
            called["runs"] += 1
            assert "Repair the draft structured output" in user_prompt

            class _Out:
                def model_dump(self) -> dict[str, Any]:
                    return {"text": "fixed", "citations": [1]}

            return type("Result", (), {"output": _Out()})()

    # Mock reason: isolate repair decision logic without invoking real LLM calls.
    monkeypatch.setattr(output_graph_mod, "Agent", _StubAgent)

    citation = Citation(
        source_id=1,
        source_name="Doc.md",
        chunk_id=1,
        chunk_index=1,
        snippet="hello",
        score=0.9,
    )
    state = OutputGraphState(
        notebook_id=1,
        output_type=OutputType.PARAGRAPH,
        prompt="",
        preference="quality",
        context="ctx",
        citations=[citation],
        effective_prompt="P",
        content={"text": " ", "citations": [1]},
    )
    deps = type("Deps", (), {"model": object(), "limiters": None})()

    ctx = cast(GraphRunContext[OutputGraphState, StudioDeps], _DummyCtx(state, deps))
    await PostprocessOutput().run(ctx)

    assert called["runs"] == 1
    assert state.content["text"] == "fixed"
    assert state.content["_postprocessed"] is True
    warnings = state.content.get("_warnings")
    assert isinstance(warnings, list)
    assert "llm_repaired" in warnings


@pytest.mark.asyncio
async def test_postprocess_output_skips_repair_when_speed_preference(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    import crystalith.shared.agents.output_graph as output_graph_mod

    # Mock reason: env flag is the supported switch for enabling repair flow.
    monkeypatch.setenv(CRYSTALITH_OUTPUT_REPAIR, "1")
    called: dict[str, Any] = {"runs": 0}

    class _StubAgent:
        def __init__(self, model, *, output_type, deps_type, system_prompt, retries):
            pass

        async def run(self, user_prompt: str, deps: Any):
            called["runs"] += 1
            raise AssertionError("repair should not run for speed preference")

    # Mock reason: isolate repair gating logic without invoking real LLM calls.
    monkeypatch.setattr(output_graph_mod, "Agent", _StubAgent)

    citation = Citation(
        source_id=1,
        source_name="Doc.md",
        chunk_id=1,
        chunk_index=1,
        snippet="hello",
        score=0.9,
    )
    state = OutputGraphState(
        notebook_id=1,
        output_type=OutputType.PARAGRAPH,
        prompt="",
        preference="speed",
        context="ctx",
        citations=[citation],
        effective_prompt="P",
        content={"text": "", "citations": [1]},
    )
    deps = type("Deps", (), {"model": object(), "limiters": None})()

    ctx = cast(GraphRunContext[OutputGraphState, StudioDeps], _DummyCtx(state, deps))
    await PostprocessOutput().run(ctx)

    assert called["runs"] == 0
    assert state.content.get("_fallback") is True


@pytest.mark.asyncio
async def test_postprocess_output_skips_repair_for_plugin_schema(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    import crystalith.shared.agents.output_graph as output_graph_mod

    # Mock reason: env flag is the supported switch for enabling repair flow.
    monkeypatch.setenv(CRYSTALITH_OUTPUT_REPAIR, "1")

    class _StubAgent:
        def __init__(self, model, *, output_type, deps_type, system_prompt, retries):
            raise AssertionError("repair should not run when plugin schema is used")

    # Mock reason: assert plugin-schema bypass path without invoking real LLM calls.
    monkeypatch.setattr(output_graph_mod, "Agent", _StubAgent)

    citation = Citation(
        source_id=1,
        source_name="Doc.md",
        chunk_id=1,
        chunk_index=1,
        snippet="hello",
        score=0.9,
    )
    state = OutputGraphState(
        notebook_id=1,
        output_type=OutputType.PARAGRAPH,
        prompt="",
        preference="quality",
        context="ctx",
        citations=[citation],
        effective_prompt="P",
        plugin_schema_used=True,
        content={"text": "", "citations": [1]},
    )
    deps = type("Deps", (), {"model": object(), "limiters": None})()

    ctx = cast(GraphRunContext[OutputGraphState, StudioDeps], _DummyCtx(state, deps))
    await PostprocessOutput().run(ctx)
    assert state.content["_postprocessed"] is True


@pytest.mark.asyncio
async def test_postprocess_output_repair_failure_falls_back_to_deterministic(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    import crystalith.shared.agents.output_graph as output_graph_mod

    # Mock reason: env flag is the supported switch for enabling repair flow.
    monkeypatch.setenv(CRYSTALITH_OUTPUT_REPAIR, "1")

    class _StubAgent:
        def __init__(self, model, *, output_type, deps_type, system_prompt, retries):
            pass

        async def run(self, user_prompt: str, deps: Any):
            raise RuntimeError("boom")

    # Mock reason: force repair failure branch without invoking real LLM calls.
    monkeypatch.setattr(output_graph_mod, "Agent", _StubAgent)

    citation = Citation(
        source_id=1,
        source_name="Doc.md",
        chunk_id=1,
        chunk_index=1,
        snippet="hello",
        score=0.9,
    )
    state = OutputGraphState(
        notebook_id=1,
        output_type=OutputType.PARAGRAPH,
        prompt="",
        preference="quality",
        context="ctx",
        citations=[citation],
        effective_prompt="P",
        content={"text": "", "citations": [1]},
    )
    deps = type("Deps", (), {"model": object(), "limiters": None})()

    ctx = cast(GraphRunContext[OutputGraphState, StudioDeps], _DummyCtx(state, deps))
    await PostprocessOutput().run(ctx)

    assert state.content.get("_fallback") is True
    warnings = state.content.get("_warnings")
    assert isinstance(warnings, list)
    assert "llm_repair_failed" in warnings
