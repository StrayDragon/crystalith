from __future__ import annotations

from crystalith.shared.config import ModelConfig
from tests._support.settings import make_settings
from crystalith.shared.config.ollama_discovery import (
    _is_embedding_model,
    _model_display_name,
    auto_discover_ollama,
    build_model_configs_from_ollama,
    collect_ollama_hosts,
    merge_discovered_models,
    probe_ollama_host,
    resolve_reachable_ollama_host,
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

    settings = make_settings(
        {
            "models": {
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
        }
    )
    added = merge_discovered_models(settings, discovered)
    assert added == 1
    assert any(m.model == "bge-m3:latest" for m in settings.models.available)


def test_auto_discover_ollama_uses_env_host(monkeypatch) -> None:
    settings = make_settings(
        {
            "models": {
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


def test_collect_ollama_hosts_without_fallback_and_without_env(monkeypatch) -> None:
    settings = make_settings(
        {
            "models": {
                "available": [
                    {
                        "id": "local-chat",
                        "provider": "ollama",
                        "model": "qwen2.5:7b",
                        "display_name": "Local chat",
                        "roles": ["chat"],
                        "provider_config": {"host": "http://localhost:11434"},
                    }
                ]
            }
        }
    )
    monkeypatch.delenv("OLLAMA_HOST", raising=False)
    hosts = collect_ollama_hosts(settings, include_env=False, include_fallback=False)
    assert hosts == {"http://localhost:11434"}


def test_collect_ollama_hosts_adds_local_fallback_for_docker_internal(monkeypatch) -> None:
    settings = make_settings(
        {
            "models": {
                "available": [
                    {
                        "id": "local-chat",
                        "provider": "ollama",
                        "model": "qwen2.5:7b",
                        "display_name": "Local chat",
                        "roles": ["chat"],
                        "provider_config": {"host": "http://host.docker.internal:11434"},
                    }
                ]
            }
        }
    )
    monkeypatch.delenv("OLLAMA_HOST", raising=False)
    hosts = collect_ollama_hosts(settings, include_env=False, include_fallback=True)
    assert "http://host.docker.internal:11434" in hosts
    assert "http://127.0.0.1:11434" in hosts


def test_probe_ollama_host_success(monkeypatch) -> None:
    class _Response:
        def raise_for_status(self) -> None:
            return

        def json(self) -> dict[str, object]:
            return {"models": [{"name": "a"}, {"name": "b"}]}

    class _Client:
        def __init__(self, timeout: float) -> None:  # noqa: ARG002
            pass

        def __enter__(self) -> _Client:
            return self

        def __exit__(self, exc_type, exc, tb) -> bool:  # noqa: ANN001, ARG002
            return False

        def get(self, url: str) -> _Response:  # noqa: ARG002
            return _Response()

    # Mock reason: avoid network dependency while validating host probe behavior.
    monkeypatch.setattr("crystalith.shared.config.ollama_discovery.httpx.Client", _Client)
    healthy, error, model_count = probe_ollama_host("http://localhost:11434", timeout=0.1)
    assert healthy is True
    assert error is None
    assert model_count == 2


def test_resolve_reachable_ollama_host_falls_back_to_localhost(monkeypatch) -> None:
    def stub_probe(host: str, *, timeout: float = 3.0):  # noqa: ANN001, ARG001
        if host == "http://localhost:11434":
            return True, None, 2
        return False, "unreachable", None

    # Mock reason: deterministic host health matrix without requiring a live Ollama daemon.
    monkeypatch.setattr("crystalith.shared.config.ollama_discovery.probe_ollama_host", stub_probe)

    host = resolve_reachable_ollama_host(
        preferred_host="http://host.docker.internal:11434",
        include_env=False,
    )
    assert host == "http://localhost:11434"
