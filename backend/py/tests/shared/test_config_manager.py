from __future__ import annotations

import json
import socket
import threading
from pathlib import Path

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


def test_config_manager_autodiscovers_secrets_file_next_to_config(tmp_path, monkeypatch) -> None:
    config_path = tmp_path / "app.yaml"
    secrets_path = tmp_path / "secrets.yaml"
    _write_yaml(secrets_path, "OPENAI_API_KEY: sk-test\n")

    _write_yaml(
        config_path,
        """\
%YAML 1.1
---
name: "Test"
version: "1.0.0"
schema: v1
providers:
  openai_main: &openai_main
    api_key: "${{ secrets.OPENAI_API_KEY }}"
    base_url: "https://example.invalid/v1"
models:
  defaults:
    chat: "test-chat"
    embedding: "test-embed"
  available:
    - id: "test-chat"
      provider: "openai"
      model: "gpt-test"
      display_name: "Test Chat"
      roles: [chat]
      provider_config:
        <<: *openai_main
    - id: "test-embed"
      provider: "openai"
      model: "embed-test"
      display_name: "Test Embed"
      roles: [embed]
      provider_config:
        <<: *openai_main
""",
    )

    manager = ConfigManager(config_path=config_path, schema_path=tmp_path / "app.schema.json")

    # Mock reason: keep config load test deterministic and independent of local Ollama availability.
    monkeypatch.setattr("crystalith.shared.config.manager.auto_discover_ollama", lambda _s: 0)

    settings = manager.load(validate_schema=False)
    model = settings.models.get_model("test-chat")
    assert model is not None
    assert model.get_openai_config().api_key == "sk-test"


def test_config_manager_ignores_legacy_env_overrides(tmp_path, monkeypatch) -> None:
    config_path = tmp_path / "app.yaml"
    _write_yaml(config_path, _minimal_config_yaml())

    manager = ConfigManager(config_path=config_path, schema_path=tmp_path / "app.schema.json")

    # Mock reason: legacy env vars may be set in developer shells; the loader must ignore them.
    monkeypatch.setenv("DATABASE_URL", "sqlite+aiosqlite:///./override.db")
    monkeypatch.setenv("CRYSTALITH_SEARCH__SEARXNG__HOST", "http://example.invalid")
    monkeypatch.setenv("CACHE_PROVIDER", "redis")
    monkeypatch.setenv("REDIS_URL", "redis://example.invalid:6379/0")

    # Mock reason: keep config load test deterministic and independent of local Ollama availability.
    monkeypatch.setattr("crystalith.shared.config.manager.auto_discover_ollama", lambda _s: 0)

    settings = manager.load(validate_schema=False)
    assert "override.db" not in settings.database.url
    assert settings.search.searxng.host == ""


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


def test_config_manager_normalizes_data_paths_from_config_root(tmp_path, monkeypatch) -> None:
    root = tmp_path / "repo"
    config_dir = root / "config"
    config_dir.mkdir(parents=True)
    config_path = config_dir / "app.yaml"

    _write_yaml(config_path, _minimal_config_yaml())

    manager = ConfigManager(config_path=config_path)

    # Mock reason: keep config load test deterministic and independent of local Ollama availability.
    monkeypatch.setattr("crystalith.shared.config.manager.auto_discover_ollama", lambda _s: 0)

    settings = manager.load(validate_schema=False)

    assert settings.database.url.startswith("sqlite")
    assert root.as_posix() in settings.database.url
    assert "/config/" not in settings.database.url
    assert settings.vector_storage.sqlite.path.startswith(root.as_posix())
    assert settings.vector_storage.chroma.path.startswith(root.as_posix())


def test_config_manager_selects_first_reachable_database_candidate(tmp_path, monkeypatch) -> None:
    sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    sock.bind(("127.0.0.1", 0))
    port = sock.getsockname()[1]
    sock.listen(5)

    stop = threading.Event()

    def _accept_loop() -> None:
        while not stop.is_set():
            try:
                sock.settimeout(0.1)
                conn, _addr = sock.accept()
                conn.close()
            except TimeoutError:
                continue
            except OSError:
                break

    thread = threading.Thread(target=_accept_loop, daemon=True)
    thread.start()

    try:
        config_path = tmp_path / "app.yaml"
        reachable = f"postgresql+asyncpg://user:pw@127.0.0.1:{port}/db"
        _write_yaml(
            config_path,
            _minimal_config_yaml()
            + "\n"
            + f"""\
database:
  url: "sqlite+aiosqlite:///./data/app.db"
  url_candidates:
    - "postgresql+asyncpg://user:pw@127.0.0.1:1/db"
    - "{reachable}"
""",
        )
        manager = ConfigManager(config_path=config_path, schema_path=tmp_path / "app.schema.json")

        # Mock reason: keep config load test deterministic and independent of local Ollama availability.
        monkeypatch.setattr("crystalith.shared.config.manager.auto_discover_ollama", lambda _s: 0)

        settings = manager.load(validate_schema=False)
        assert settings.database.url == reachable
    finally:
        stop.set()
        try:
            sock.close()
        except OSError:
            pass


def test_config_manager_skips_postgres_candidate_without_password(tmp_path, monkeypatch) -> None:
    sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    sock.bind(("127.0.0.1", 0))
    port = sock.getsockname()[1]
    sock.listen(5)

    stop = threading.Event()

    def _accept_loop() -> None:
        while not stop.is_set():
            try:
                sock.settimeout(0.1)
                conn, _addr = sock.accept()
                conn.close()
            except TimeoutError:
                continue
            except OSError:
                break

    thread = threading.Thread(target=_accept_loop, daemon=True)
    thread.start()

    try:
        config_path = tmp_path / "app.yaml"
        candidate = f"postgresql+asyncpg://user:@127.0.0.1:{port}/db"
        _write_yaml(
            config_path,
            _minimal_config_yaml()
            + "\n"
            + f"""\
database:
  url: "sqlite+aiosqlite:///./data/app.db"
  url_candidates:
    - "{candidate}"
""",
        )
        manager = ConfigManager(config_path=config_path, schema_path=tmp_path / "app.schema.json")

        # Mock reason: keep config load test deterministic and independent of local Ollama availability.
        monkeypatch.setattr("crystalith.shared.config.manager.auto_discover_ollama", lambda _s: 0)

        settings = manager.load(validate_schema=False)
        assert "sqlite" in settings.database.url
        assert settings.database.url != candidate
    finally:
        stop.set()
        try:
            sock.close()
        except OSError:
            pass
