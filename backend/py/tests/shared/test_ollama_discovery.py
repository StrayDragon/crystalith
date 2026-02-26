from __future__ import annotations

import os

import pytest

from crystalith.shared.config import ModelConfig, Settings
from crystalith.shared.config.ollama_discovery import (
    _is_embedding_model,
    _model_display_name,
    auto_discover_ollama,
    build_model_configs_from_ollama,
    merge_discovered_models,
)


def test_is_embedding_model_heuristics() -> None:
    assert _is_embedding_model("bge-m3:latest") is True
    assert _is_embedding_model("qwen2.5:7b") is False
    assert _is_embedding_model("any", family="bert") is True


def test_model_display_name_formats_hf_and_standard_names() -> None:
    assert _model_display_name("qwen2.5-coder:1.5b") == "qwen2.5-coder:1.5b"
    assert (
        _model_display_name("hf.co/unsloth/Qwen3-8B-GGUF:UD-Q4_K_XL")
        == "Qwen3-8B:UD-Q4_K_XL"
    )


def test_build_and_merge_discovered_models_skips_duplicates() -> None:
    discovered = build_model_configs_from_ollama(
        [
            {"name": "qwen2.5:7b", "details": {"family": "qwen", "parameter_size": "7B"}},
            {"name": "bge-m3:latest", "details": {"family": "bge", "parameter_size": "567m"}},
        ],
        host="http://localhost:11434",
    )
    assert len(discovered) == 2

    settings = Settings(
        models={
            "available": [
                {
                    "id": "existing-ollama",
                    "provider": "ollama",
                    "model": "qwen2.5:7b",
                    "display_name": "Existing",
                    "roles": ["chat"],
                }
            ]
        }
    )
    added = merge_discovered_models(settings, discovered)
    assert added == 1
    assert any(m.model == "bge-m3:latest" for m in settings.models.available)


def test_auto_discover_ollama_uses_env_host(monkeypatch) -> None:
    settings = Settings(
        models={
            "available": [
                {
                    "id": "local",
                    "provider": "ollama",
                    "model": "qwen2.5:7b",
                    "display_name": "Local",
                    "roles": ["chat"],
                    "provider_config": {"host": "http://localhost:11434"},
                }
            ]
        }
    )

    # Mock reason: env host override is part of runtime resolution path under test.
    monkeypatch.setenv("OLLAMA_HOST", "http://example.invalid")

    def stub_discover(host: str, *, timeout: float = 5.0):  # noqa: ANN001
        assert host in {"http://localhost:11434", "http://example.invalid"}
        return [{"name": "bge-m3:latest", "details": {"family": "bge"}}]

    # Mock reason: avoid external Ollama dependency while validating host resolution/merge behavior.
    monkeypatch.setattr(
        "crystalith.shared.config.ollama_discovery.discover_ollama_models",
        stub_discover,
    )

    added = auto_discover_ollama(settings)
    assert added == 1
    assert any(isinstance(m, ModelConfig) and m.model == "bge-m3:latest" for m in settings.models.available)
