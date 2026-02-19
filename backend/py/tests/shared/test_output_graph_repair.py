from __future__ import annotations

from typing import Any

import pytest

from crystalith.shared.agents.output_graph import OutputGraphState, PostprocessOutput
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

    monkeypatch.setenv(output_graph_mod.OUTPUT_REPAIR_ENV, "1")
    called: dict[str, Any] = {"runs": 0}

    class _StubAgent:
        def __init__(self, model, *, output_type, deps_type, system_prompt, retries):  # noqa: ANN001
            called["schema"] = output_type

        async def run(self, user_prompt: str, deps: Any):  # noqa: ANN001
            called["runs"] += 1
            assert "Repair the draft structured output" in user_prompt

            class _Out:
                def model_dump(self) -> dict[str, Any]:
                    return {"text": "fixed", "citations": [1]}

            return type("Result", (), {"output": _Out()})()

    monkeypatch.setattr(output_graph_mod, "Agent", _StubAgent)

    state = OutputGraphState(
        notebook_id=1,
        output_type=OutputType.PARAGRAPH,
        prompt="",
        preference="quality",
        context="ctx",
        citations=[object()],
        effective_prompt="P",
        content={"text": " ", "citations": [1]},
    )
    deps = type("Deps", (), {"model": object()})()

    await PostprocessOutput().run(_DummyCtx(state, deps))

    assert called["runs"] == 1
    assert state.content["text"] == "fixed"
    assert state.content["_postprocessed"] is True
    assert "llm_repaired" in (state.content.get("_warnings") or [])


@pytest.mark.asyncio
async def test_postprocess_output_skips_repair_when_speed_preference(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    import crystalith.shared.agents.output_graph as output_graph_mod

    monkeypatch.setenv(output_graph_mod.OUTPUT_REPAIR_ENV, "1")
    called: dict[str, Any] = {"runs": 0}

    class _StubAgent:
        def __init__(self, model, *, output_type, deps_type, system_prompt, retries):  # noqa: ANN001
            pass

        async def run(self, user_prompt: str, deps: Any):  # noqa: ANN001
            called["runs"] += 1
            raise AssertionError("repair should not run for speed preference")

    monkeypatch.setattr(output_graph_mod, "Agent", _StubAgent)

    state = OutputGraphState(
        notebook_id=1,
        output_type=OutputType.PARAGRAPH,
        prompt="",
        preference="speed",
        context="ctx",
        citations=[object()],
        effective_prompt="P",
        content={"text": "", "citations": [1]},
    )
    deps = type("Deps", (), {"model": object()})()

    await PostprocessOutput().run(_DummyCtx(state, deps))

    assert called["runs"] == 0
    assert state.content.get("_fallback") is True


@pytest.mark.asyncio
async def test_postprocess_output_skips_repair_for_plugin_schema(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    import crystalith.shared.agents.output_graph as output_graph_mod

    monkeypatch.setenv(output_graph_mod.OUTPUT_REPAIR_ENV, "1")

    class _StubAgent:
        def __init__(self, model, *, output_type, deps_type, system_prompt, retries):  # noqa: ANN001
            raise AssertionError("repair should not run when plugin schema is used")

    monkeypatch.setattr(output_graph_mod, "Agent", _StubAgent)

    state = OutputGraphState(
        notebook_id=1,
        output_type=OutputType.PARAGRAPH,
        prompt="",
        preference="quality",
        context="ctx",
        citations=[object()],
        effective_prompt="P",
        plugin_schema_used=True,
        content={"text": "", "citations": [1]},
    )
    deps = type("Deps", (), {"model": object()})()

    await PostprocessOutput().run(_DummyCtx(state, deps))
    assert state.content["_postprocessed"] is True


@pytest.mark.asyncio
async def test_postprocess_output_repair_failure_falls_back_to_deterministic(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    import crystalith.shared.agents.output_graph as output_graph_mod

    monkeypatch.setenv(output_graph_mod.OUTPUT_REPAIR_ENV, "1")

    class _StubAgent:
        def __init__(self, model, *, output_type, deps_type, system_prompt, retries):  # noqa: ANN001
            pass

        async def run(self, user_prompt: str, deps: Any):  # noqa: ANN001
            raise RuntimeError("boom")

    monkeypatch.setattr(output_graph_mod, "Agent", _StubAgent)

    state = OutputGraphState(
        notebook_id=1,
        output_type=OutputType.PARAGRAPH,
        prompt="",
        preference="quality",
        context="ctx",
        citations=[object()],
        effective_prompt="P",
        content={"text": "", "citations": [1]},
    )
    deps = type("Deps", (), {"model": object()})()

    await PostprocessOutput().run(_DummyCtx(state, deps))

    assert state.content.get("_fallback") is True
    assert "llm_repair_failed" in (state.content.get("_warnings") or [])
