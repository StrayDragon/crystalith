from __future__ import annotations

import json
from pathlib import Path

import pytest

from crystalith.shared.config import ConfigManager, Settings
from tests._support.settings import make_settings


def _write_yaml(path: Path, content: str) -> None:
    path.write_text(content, encoding="utf-8")


def _minimal_config_yaml() -> str:
    return """\
%YAML 1.1
---
name: "Test"
version: "1.0.0"
schema: v1
models:
  defaults:
    chat: "test-chat"
    embedding: "test-embed"
  available:
    - id: "test-chat"
      provider: "test"
      model: "test-chat"
      display_name: "Test Chat"
      roles: [chat]
    - id: "test-embed"
      provider: "test"
      model: "test-embed"
      display_name: "Test Embed"
      roles: [embed]
"""


def test_config_manager_schema_reference_and_comment(tmp_path) -> None:
    config_path = tmp_path / "app.yaml"
    schema_path = tmp_path / "app.schema.json"

    manager = ConfigManager(config_path=config_path, schema_path=schema_path)
    assert manager.schema_reference() == "./app.schema.json"
    assert manager.schema_comment().startswith("# yaml-language-server: $schema=")


def test_config_manager_write_schema(tmp_path) -> None:
    config_path = tmp_path / "app.yaml"
    schema_path = tmp_path / "app.schema.json"
    manager = ConfigManager(config_path=config_path, schema_path=schema_path)

    written = manager.write_schema()
    assert written.is_file()

    payload = json.loads(written.read_text(encoding="utf-8"))
    assert payload.get("$schema")
    assert payload.get("title")


def test_config_manager_validate_yaml_with_schema_reports_errors(tmp_path) -> None:
    config_path = tmp_path / "app.yaml"
    schema_path = tmp_path / "app.schema.json"

    manager = ConfigManager(config_path=config_path, schema_path=schema_path)
    manager.write_schema()

    _write_yaml(
        config_path,
        _minimal_config_yaml().replace('url: "sqlite+aiosqlite:///./data/app.db"', "url: 123"),
    )

    is_valid, errors = manager.validate_yaml_with_schema()
    assert is_valid is True
    assert errors == []

    # Intentionally invalid type against schema (database.url expects string).
    _write_yaml(
        config_path,
        _minimal_config_yaml()
        + "\ndatabase:\n  url: 123\n",
    )
    is_valid2, errors2 = manager.validate_yaml_with_schema()
    assert is_valid2 is False
    assert errors2


def test_config_manager_load_secrets_from_file_and_directory(tmp_path) -> None:
    config_path = tmp_path / "app.yaml"
    schema_path = tmp_path / "app.schema.json"

    secrets_file = tmp_path / "secrets.yaml"
    _write_yaml(secrets_file, "OPENAI_API_KEY: sk-test\n")

    manager = ConfigManager(config_path=config_path, schema_path=schema_path, secrets_path=secrets_file)
    assert manager._load_secrets()["OPENAI_API_KEY"] == "sk-test"

    docker_secrets_dir = tmp_path / "secrets.d"
    docker_secrets_dir.mkdir()
    (docker_secrets_dir / "TOKEN").write_text("t", encoding="utf-8")

    manager2 = ConfigManager(config_path=config_path, schema_path=schema_path, secrets_path=docker_secrets_dir)
    assert manager2._load_secrets()["TOKEN"] == "t"


def test_config_manager_apply_env_overrides_updates_models_and_defaults(monkeypatch) -> None:
    settings = make_settings(
        {
            "cache": {"provider": "memory"},
            "models": {
                "defaults": {"chat": "test-chat", "embedding": "test-embed"},
                "available": [
                    {
                        "id": "test-chat",
                        "provider": "openai",
                        "model": "gpt-test",
                        "display_name": "Test Chat",
                        "roles": ["chat"],
                        "provider_config": {"api_key": "old", "base_url": "http://old"},
                    },
                    {
                        "id": "test-embed",
                        "provider": "ollama",
                        "model": "bge-test",
                        "display_name": "Test Embed",
                        "roles": ["embed"],
                        "provider_config": {"host": "http://old"},
                    },
                ],
            },
        }
    )
    manager = ConfigManager(config_path=Path("config/app.yaml"))

    # Mock reason: env overrides are the public contract this method applies onto loaded config.
    monkeypatch.setenv("DATABASE_URL", "sqlite+aiosqlite:///./override.db")
    monkeypatch.setenv("CACHE_PROVIDER", "redis")
    monkeypatch.setenv("REDIS_URL", "redis://localhost:6379/0")
    monkeypatch.setenv("OPENAI_API_KEY", "sk-new")
    monkeypatch.setenv("OPENAI_BASE_URL", "http://new")
    monkeypatch.setenv("OLLAMA_HOST", "http://ollama")
    monkeypatch.setenv("CRYSTALITH_OPTIONAL_OLLAMA_ENABLED", "1")
    monkeypatch.setenv("CRYSTALITH_OPTIONAL_OLLAMA_ENDPOINT", "http://ollama:11434")
    monkeypatch.setenv("CRYSTALITH_OPTIONAL_OLLAMA_PROBE_INTERVAL_S", "30")
    monkeypatch.setenv("CRYSTALITH_OPTIONAL_OLLAMA_DEGRADE_POLICY", "core_available")
    # Mock reason: default model selection is configured via env in production deployments.
    monkeypatch.setenv("CRYSTALITH_DEFAULT_CHAT_MODEL", "test-chat")

    manager._apply_env_overrides(settings, secrets={})

    assert settings.database.url.endswith("override.db")
    assert settings.cache.provider == "redis"
    redis_url = settings.cache.redis_url
    assert redis_url is not None
    assert redis_url.startswith("redis://")

    openai_model = settings.models.get_model("test-chat")
    assert openai_model is not None
    assert openai_model.get_openai_config().api_key == "sk-new"
    assert openai_model.get_openai_config().base_url == "http://new"

    ollama_model = settings.models.get_model("test-embed")
    assert ollama_model is not None
    assert ollama_model.get_ollama_config().host == "http://ollama"
    assert settings.optional_services.ollama.enabled is True
    assert settings.optional_services.ollama.endpoint == "http://ollama:11434"
    assert settings.optional_services.ollama.probe.interval_s == 30
    assert settings.optional_services.ollama.degrade_policy == "core_available"


def test_config_manager_apply_env_overrides_rejects_unknown_default_model(monkeypatch) -> None:
    settings = make_settings({"models": {"available": []}})
    manager = ConfigManager(config_path=Path("config/app.yaml"))
    # Mock reason: invalid default model id is injected through env variables in production.
    monkeypatch.setenv("CRYSTALITH_DEFAULT_CHAT_MODEL", "missing")
    with pytest.raises(ValueError, match="Invalid default chat model id"):
        manager._apply_env_overrides(settings, secrets={})


def test_config_manager_validate_config_returns_warnings() -> None:
    settings = make_settings(
        {
            "models": {
                "available": [
                    {
                        "id": "chat",
                        "provider": "openai",
                        "model": "gpt",
                        "display_name": "Chat",
                        "roles": ["chat"],
                        "provider_config": {"api_key": ""},
                    },
                    {
                        "id": "embed",
                        "provider": "ollama",
                        "model": "bge",
                        "display_name": "Embed",
                        "roles": ["embed"],
                        "provider_config": {"host": ""},
                    },
                ]
            }
        }
    )
    manager = ConfigManager(config_path=Path("config/app.yaml"))
    manager._settings = settings
    warnings = manager.validate_config()
    assert any("no api_key" in msg for msg in warnings)
    assert any("no host" in msg for msg in warnings)


def test_config_manager_load_roundtrip_with_schema(tmp_path, monkeypatch) -> None:
    config_path = tmp_path / "app.yaml"
    schema_path = tmp_path / "app.schema.json"
    _write_yaml(config_path, _minimal_config_yaml())

    manager = ConfigManager(config_path=config_path, schema_path=schema_path)
    manager.write_schema()

    # Mock reason: keep config load test deterministic and independent of local Ollama availability.
    monkeypatch.setattr("crystalith.shared.config.manager.auto_discover_ollama", lambda _s: 0)

    settings = manager.load(validate_schema=True)
    assert isinstance(settings, Settings)
    assert settings.models.get_default_for_role("chat") is not None
