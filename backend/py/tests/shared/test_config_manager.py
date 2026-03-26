from __future__ import annotations

import contextlib
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
    schema_path = tmp_path / "app.schema.gen.json"

    manager = ConfigManager(config_path=config_path, schema_path=schema_path)
    assert manager.schema_reference() == "./app.schema.gen.json"
    assert manager.schema_comment().startswith("# yaml-language-server: $schema=")


def test_config_manager_write_schema(tmp_path) -> None:
    config_path = tmp_path / "app.yaml"
    schema_path = tmp_path / "app.schema.gen.json"
    manager = ConfigManager(config_path=config_path, schema_path=schema_path)

    written = manager.write_schema()
    assert written.is_file()

    payload = json.loads(written.read_text(encoding="utf-8"))
    assert payload.get("$schema")
    assert payload.get("title")


def test_config_manager_validate_yaml_with_schema_reports_errors(tmp_path) -> None:
    config_path = tmp_path / "app.yaml"
    schema_path = tmp_path / "app.schema.gen.json"

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


def test_config_manager_loads_secret_env_next_to_config(
    tmp_path,
    disable_ollama_auto_discovery,
) -> None:
    config_path = tmp_path / "app.yaml"

    secret_env = tmp_path / "secret.env"
    secret_env.write_text("OPENAI_API_KEY=sk-test\n", encoding="utf-8")

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
    api_key: "{{ secret.OPENAI_API_KEY }}"
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

    manager = ConfigManager(config_path=config_path, schema_path=tmp_path / "app.schema.gen.json")

    settings = manager.load(validate_schema=False)
    model = settings.models.get_model("test-chat")
    assert model is not None
    assert model.get_openai_config().api_key == "sk-test"


def test_config_manager_dotenv_overrides_system_env(
    tmp_path,
    monkeypatch,
    disable_ollama_auto_discovery,
) -> None:
    root = tmp_path / "repo"
    config_dir = root / "config"
    config_dir.mkdir(parents=True)
    config_path = config_dir / "app.yaml"
    (root / ".env").write_text("FOO=2\n", encoding="utf-8")

    monkeypatch.setenv("FOO", "1")

    _write_yaml(
        config_path,
        _minimal_config_yaml().replace('name: "Test"', 'name: "{{ env.FOO }}"'),
    )

    manager = ConfigManager(config_path=config_path, schema_path=config_dir / "app.schema.gen.json")
    settings = manager.load(validate_schema=False)
    assert settings.name == "2"


def test_config_manager_missing_secret_fails_with_hint(
    tmp_path,
    disable_ollama_auto_discovery,
) -> None:
    config_path = tmp_path / "app.yaml"
    _write_yaml(
        config_path,
        _minimal_config_yaml().replace('name: "Test"', 'name: "{{ secret.MISSING }}"'),
    )

    manager = ConfigManager(config_path=config_path, schema_path=tmp_path / "app.schema.gen.json")
    try:
        manager.load(validate_schema=False)
        raise AssertionError("Expected config template render to fail due to missing secret")
    except ValueError as exc:
        message = str(exc)
        assert "secret missing" in message
        assert "secret.env" in message


def test_config_manager_template_syntax_error_includes_location(
    tmp_path,
    disable_ollama_auto_discovery,
) -> None:
    config_path = tmp_path / "app.yaml"
    _write_yaml(
        config_path,
        _minimal_config_yaml().replace('name: "Test"', 'name: "{{ env.FOO | default( }}"'),
    )

    manager = ConfigManager(config_path=config_path, schema_path=tmp_path / "app.schema.gen.json")
    try:
        manager.load(validate_schema=False)
        raise AssertionError("Expected template syntax error to fail config load")
    except ValueError as exc:
        message = str(exc)
        assert "Config template syntax error" in message
        assert str(config_path) in message
        assert ":1:" in message


def test_config_manager_ignores_legacy_env_overrides(
    tmp_path,
    monkeypatch,
    disable_ollama_auto_discovery,
) -> None:
    config_path = tmp_path / "app.yaml"
    _write_yaml(config_path, _minimal_config_yaml())

    manager = ConfigManager(config_path=config_path, schema_path=tmp_path / "app.schema.gen.json")

    # Mock reason: legacy env vars may be set in developer shells; the loader must ignore them.
    monkeypatch.setenv("DATABASE_URL", "sqlite+aiosqlite:///./override.db")
    monkeypatch.setenv("CRYSTALITH_SEARCH__SEARXNG__HOST", "http://example.invalid")
    monkeypatch.setenv("CACHE_PROVIDER", "redis")
    monkeypatch.setenv("REDIS_URL", "redis://example.invalid:6379/0")

    settings = manager.load(validate_schema=False)
    assert "override.db" not in settings.database.url
    assert settings.search.searxng.host == ""


def test_config_manager_auto_selects_gateway_embedding_model(
    tmp_path,
    monkeypatch,
    disable_ollama_auto_discovery,
) -> None:
    config_path = tmp_path / "app.yaml"
    _write_yaml(
        config_path,
        """\
%YAML 1.1
---
name: "Test"
version: "1.0.0"
schema: v1
providers:
  openai_default: &openai_default
    api_key: "sk-test"
    base_url: "http://gateway.lan:50256/v1"
models:
  defaults:
    chat: "test-chat"
    embedding: ""
  available:
    - id: "test-chat"
      provider: "openai"
      model: "gpt-test"
      display_name: "Test Chat"
      roles: [chat]
      provider_config:
        <<: *openai_default
    - id: "text-embedding-3-small"
      provider: "openai"
      model: "text-embedding-3-small"
      display_name: "OpenAI Embed"
      roles: [embed]
      provider_config:
        <<: *openai_default
    - id: "bge-m3-openai"
      provider: "openai"
      model: "BAAI/bge-m3"
      display_name: "BGE-M3 (gateway)"
      roles: [embed]
      provider_config:
        <<: *openai_default
""",
    )
    manager = ConfigManager(config_path=config_path, schema_path=tmp_path / "app.schema.gen.json")

    settings = manager.load(validate_schema=False)
    assert settings.models.defaults.embedding == "bge-m3-openai"


def test_config_manager_does_not_override_official_openai_embedding_default(
    tmp_path,
    monkeypatch,
    disable_ollama_auto_discovery,
) -> None:
    config_path = tmp_path / "app.yaml"
    _write_yaml(
        config_path,
        """\
%YAML 1.1
---
name: "Test"
version: "1.0.0"
schema: v1
providers:
  openai_default: &openai_default
    api_key: "sk-test"
    base_url: "https://api.openai.com/v1"
models:
  defaults:
    chat: "test-chat"
    embedding: ""
  available:
    - id: "test-chat"
      provider: "openai"
      model: "gpt-test"
      display_name: "Test Chat"
      roles: [chat]
      provider_config:
        <<: *openai_default
    - id: "text-embedding-3-small"
      provider: "openai"
      model: "text-embedding-3-small"
      display_name: "OpenAI Embed"
      roles: [embed]
      provider_config:
        <<: *openai_default
    - id: "bge-m3-openai"
      provider: "openai"
      model: "BAAI/bge-m3"
      display_name: "BGE-M3 (gateway)"
      roles: [embed]
      provider_config:
        <<: *openai_default
""",
    )
    manager = ConfigManager(config_path=config_path, schema_path=tmp_path / "app.schema.gen.json")

    settings = manager.load(validate_schema=False)
    assert settings.get_default_embedding_model() is not None
    assert settings.get_default_embedding_model().id == "text-embedding-3-small"


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


def test_config_manager_load_roundtrip_with_schema(
    tmp_path,
    monkeypatch,
    disable_ollama_auto_discovery,
) -> None:
    config_path = tmp_path / "app.yaml"
    schema_path = tmp_path / "app.schema.gen.json"
    _write_yaml(config_path, _minimal_config_yaml())

    manager = ConfigManager(config_path=config_path, schema_path=schema_path)
    manager.write_schema()

    settings = manager.load(validate_schema=True)
    assert isinstance(settings, Settings)
    assert settings.models.get_default_for_role("chat") is not None


def test_config_manager_normalizes_data_paths_from_config_root(
    tmp_path,
    monkeypatch,
    disable_ollama_auto_discovery,
) -> None:
    root = tmp_path / "repo"
    config_dir = root / "config"
    config_dir.mkdir(parents=True)
    config_path = config_dir / "app.yaml"

    _write_yaml(config_path, _minimal_config_yaml())

    manager = ConfigManager(config_path=config_path)

    settings = manager.load(validate_schema=False)

    assert settings.database.url.startswith("sqlite")
    assert root.as_posix() in settings.database.url
    assert "/config/" not in settings.database.url
    assert settings.vector_storage.sqlite.path.startswith(root.as_posix())
    assert settings.vector_storage.chroma.path.startswith(root.as_posix())


def test_config_manager_selects_first_reachable_database_candidate(
    tmp_path,
    monkeypatch,
    disable_ollama_auto_discovery,
) -> None:
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
        manager = ConfigManager(config_path=config_path, schema_path=tmp_path / "app.schema.gen.json")

        settings = manager.load(validate_schema=False)
        assert settings.database.url == reachable
    finally:
        stop.set()
        with contextlib.suppress(OSError):
            sock.close()


def test_config_manager_skips_postgres_candidate_without_password(
    tmp_path,
    monkeypatch,
    disable_ollama_auto_discovery,
) -> None:
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
        manager = ConfigManager(config_path=config_path, schema_path=tmp_path / "app.schema.gen.json")

        settings = manager.load(validate_schema=False)
        assert "sqlite" in settings.database.url
        assert settings.database.url != candidate
    finally:
        stop.set()
        with contextlib.suppress(OSError):
            sock.close()
