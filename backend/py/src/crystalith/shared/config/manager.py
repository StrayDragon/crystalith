from __future__ import annotations

import ipaddress
import json
import logging
import os
from pathlib import Path
from urllib.parse import urlparse

import yaml
from jsonschema import Draft7Validator
from pydantic import ValidationError

from crystalith.shared.json_types import JsonValue

from .endpoint_candidates import (
    order_endpoint_candidates,
    probe_tcp_endpoint,
    tcp_target_from_endpoint,
)
from .models import OllamaProviderSettings, Settings
from .ollama_discovery import auto_discover_ollama

logger = logging.getLogger(__name__)


class ConfigManager:
    """
    Configuration manager with support for:

    - YAML configuration files
    - Environment variable interpolation (${{ env.VAR }})
    - Secrets file support (${{ secrets.VAR }})
    - JSON Schema generation for editor validation
    - YAML anchors for reusable configurations

    Example usage:

        manager = ConfigManager(
            config_path=Path("config/app.yaml"),
            secrets_path=Path("config/secrets.yaml"),  # Optional
        )
        settings = manager.load()

        # Access models
        model = settings.get_model_config("gpt-5.2")

        # Get defaults
        chat_model = settings.get_default_chat_model()
    """

    def __init__(
        self,
        config_path: Path,
        schema_path: Path | None = None,
        secrets_path: Path | None = None,
    ) -> None:
        """
        Initialize the config manager.

        Args:
            config_path: Path to the main YAML config file
            schema_path: Path to write JSON schema (defaults to config/app.schema.gen.json)
            secrets_path: Optional path to secrets YAML file
        """
        self.config_path = config_path
        self.schema_path = schema_path or Path("config/app.schema.gen.json")
        self.secrets_path = secrets_path
        self._settings: Settings | None = None
        self._secrets: dict[str, str] | None = None

    def _load_secrets(self) -> dict[str, str]:
        """
        Load secrets from a secrets file.

        The secrets file should be a simple YAML mapping:

            OPENAI_API_KEY: "sk-..."
            DATABASE_PASSWORD: "secret"
        """
        if self._secrets is not None:
            return self._secrets

        secrets_path = self.secrets_path
        if secrets_path is None:
            for candidate_name in ("secrets.yaml", "secrets.yml"):
                candidate = self.config_path.parent / candidate_name
                if candidate.is_file():
                    secrets_path = candidate
                    break

        if secrets_path is None or not secrets_path.is_file():
            if secrets_path is not None and secrets_path.is_dir():
                secrets: dict[str, str] = {}
                for item in secrets_path.iterdir():
                    if not item.is_file():
                        continue
                    try:
                        secrets[item.name] = item.read_text(encoding="utf-8").strip()
                    except Exception as exc:
                        logger.warning("Failed to read secret %s: %s", item, exc)
                self._secrets = secrets
                logger.info("Loaded %d docker secrets from %s", len(secrets), secrets_path.resolve())
                return self._secrets

            self._secrets = {}
            return self._secrets

        try:
            with open(secrets_path, encoding="utf-8") as f:
                data = yaml.safe_load(f)
                self._secrets = {str(k): str(v) for k, v in (data or {}).items()}
                logger.info("Loaded secrets from %s", secrets_path.resolve())
        except Exception as exc:
            logger.warning("Failed to load secrets from %s: %s", secrets_path, exc)
            self._secrets = {}

        return self._secrets

    def _normalize_storage_paths(self, settings: Settings) -> None:
        """
        Normalize relative storage paths to be stable regardless of CWD.

        Rule:
        - When config is at <root>/config/app.yaml, treat <root> as project root and
          rewrite relative paths (./data/...) to absolute paths under <root>.
        - Otherwise, treat the config directory as the root anchor.
        """
        config_path = self.config_path.resolve()
        config_dir = config_path.parent
        root_dir = config_dir.parent if config_dir.name == "config" else config_dir

        def _abs_path(path_value: str) -> str:
            raw = (path_value or "").strip()
            if not raw:
                return path_value
            path = Path(raw)
            if path.is_absolute():
                return path.as_posix()
            return (root_dir / path).resolve().as_posix()

        def _normalize_sqlite_url(url_value: str) -> str:
            url = (url_value or "").strip()
            if not url.startswith("sqlite"):
                return url_value

            scheme, rest = url.split(":", 1)
            if rest.startswith("////"):
                return url_value
            if not rest.startswith("///"):
                return url_value

            raw_path = rest[3:]
            path_part, sep, query = raw_path.partition("?")
            if path_part in {":memory:", ""} or path_part.startswith(":memory:"):
                return url_value
            if path_part.startswith("file:"):
                return url_value

            abs_path = (root_dir / Path(path_part)).resolve().as_posix().lstrip("/")
            normalized = f"{scheme}:////{abs_path}"
            if sep:
                normalized = f"{normalized}?{query}"
            return normalized

        settings.database.url = _normalize_sqlite_url(settings.database.url)
        settings.vector_storage.sqlite.path = _abs_path(settings.vector_storage.sqlite.path)
        settings.vector_storage.chroma.path = _abs_path(settings.vector_storage.chroma.path)

    def _apply_endpoint_candidates(self, settings: Settings) -> None:
        """
        Resolve optional service endpoint candidates into concrete settings.

        This intentionally avoids environment-variable based overrides and instead relies
        on explicit YAML configuration (with optional probing for reachability).
        """

        def _is_postgres_url_missing_password(url_value: str) -> bool:
            raw = (url_value or "").strip()
            if not raw or "://" not in raw:
                return False
            parsed = urlparse(raw)
            scheme = (parsed.scheme or "").lower()
            if not scheme.startswith("postgres"):
                return False
            username = parsed.username
            password = parsed.password
            return bool(username and not (password or "").strip())

        # Database: keep sqlite unless a candidate is reachable and safe to use.
        db_candidates = [c for c in order_endpoint_candidates(settings.database.url_candidates) if c.strip()]
        if db_candidates:
            for candidate in db_candidates:
                if _is_postgres_url_missing_password(candidate):
                    logger.info(
                        "Skipping postgres candidate without password. "
                        "Hint: set secrets.POSTGRES_PASSWORD or explicitly set database.url.",
                    )
                    continue
                ok, _ = probe_tcp_endpoint(candidate, timeout_s=0.4)
                if ok:
                    settings.database.url = candidate
                    break

        # Vector store: prefer remote Chroma when reachable; otherwise keep YAML host/port as-is.
        if settings.vector_storage.provider == "chroma":
            chroma_candidates = [
                c for c in order_endpoint_candidates(settings.vector_storage.chroma.endpoint_candidates) if c.strip()
            ]
            for candidate in chroma_candidates:
                ok, _ = probe_tcp_endpoint(candidate, timeout_s=0.4)
                if not ok:
                    continue
                target = tcp_target_from_endpoint(candidate)
                if target is None:
                    continue
                settings.vector_storage.chroma.host = target.host
                settings.vector_storage.chroma.port = target.port
                # Keep diagnostics aligned with the chosen endpoint.
                settings.optional_services.chroma.endpoint = candidate
                break

        # Ollama: align all ollama model hosts to the first reachable candidate (if any).
        ollama_candidates = [
            c for c in order_endpoint_candidates(settings.optional_services.ollama.endpoint_candidates) if c.strip()
        ]
        if ollama_candidates:
            selected_ollama: str | None = None
            for candidate in ollama_candidates:
                ok, _ = probe_tcp_endpoint(candidate, timeout_s=0.4)
                if ok:
                    selected_ollama = candidate
                    break

            if selected_ollama:
                for model in settings.models.available:
                    if model.provider != "ollama":
                        continue
                    if isinstance(model.provider_config, OllamaProviderSettings):
                        model.provider_config.host = selected_ollama
                    elif isinstance(model.provider_config, dict):
                        model.provider_config["host"] = selected_ollama
                    else:
                        model.provider_config = {"host": selected_ollama}
                settings.optional_services.ollama.endpoint = selected_ollama

    def _apply_model_defaults(self, settings: Settings) -> None:
        """
        Apply runtime-friendly model defaults when config does not specify one.

        Motivation:
        - When `OPENAI_BASE_URL` points to an OpenAI-compatible gateway, the gateway may not serve
          OpenAI-native embedding models (e.g. `text-embedding-3-*`). In that case, leaving the
          embedding default unset can lead to confusing runtime failures on first ingestion.

        Behavior:
        - If `models.defaults.embedding` is not set and an OpenAI-compatible gateway is detected,
          prefer the first embedding model whose id ends with `-openai` (gateway-friendly convention).
        """
        if (settings.models.defaults.embedding or "").strip():
            return

        openai_base_url = ""
        openai_default = settings.providers.get("openai_default")
        if isinstance(openai_default, dict):
            base_url_value = openai_default.get("base_url")
            if isinstance(base_url_value, str):
                openai_base_url = base_url_value.strip()
            elif base_url_value is not None:
                openai_base_url = str(base_url_value).strip()

        if not openai_base_url:
            for model in settings.models.available:
                if model.provider != "openai":
                    continue
                openai_base_url = (model.get_openai_config().base_url or "").strip()
                if openai_base_url:
                    break

        if not openai_base_url:
            openai_base_url = os.environ.get("OPENAI_BASE_URL", "").strip()

        if not openai_base_url:
            return

        try:
            parsed = urlparse(openai_base_url)
        except Exception:
            return
        scheme = (parsed.scheme or "").lower()
        host = (parsed.hostname or "").lower()
        if not host:
            return

        if host == "api.openai.com" or host.endswith(".openai.com"):
            return

        is_localish_gateway = scheme == "http" or host in {"localhost", "host.docker.internal"}
        if not is_localish_gateway and host.endswith((".lan", ".local", ".internal")):
            is_localish_gateway = True
        if not is_localish_gateway:
            try:
                ip = ipaddress.ip_address(host)
                is_localish_gateway = bool(ip.is_private or ip.is_loopback)
            except ValueError:
                pass
        if not is_localish_gateway:
            return

        for model in settings.models.available:
            if not model.has_role("embed"):
                continue
            if model.provider != "openai":
                continue
            model_id = (model.id or "").strip()
            if not model_id or not model_id.endswith("-openai"):
                continue
            settings.models.defaults.embedding = model_id
            logger.info("Auto-selected gateway embedding model: %s (base_url=%s)", model_id, openai_base_url)
            return

    def _validate_with_jsonschema(self, data: dict[str, JsonValue]) -> list[str]:
        """
        Validate configuration data against JSON Schema.

        Returns a list of validation error messages.
        """
        if not self.schema_path.is_file():
            logger.warning("JSON Schema not found at %s, skipping validation", self.schema_path)
            return []

        try:
            with open(self.schema_path, encoding="utf-8") as f:
                schema = json.load(f)
        except Exception as exc:
            logger.warning("Failed to load JSON Schema: %s", exc)
            return []

        validator = Draft7Validator(schema)
        errors: list[str] = []

        for error in validator.iter_errors(data):
            # Build a readable path
            path = " -> ".join(str(p) for p in error.absolute_path) if error.absolute_path else "root"
            errors.append(f"[{path}] {error.message}")

        return errors

    def validate_yaml_with_schema(self) -> tuple[bool, list[str]]:
        """
        Validate the YAML config file against JSON Schema.

        Returns:
            (is_valid, errors) tuple
        """
        if not self.config_path.is_file():
            return False, [f"Config file not found: {self.config_path}"]

        try:
            with open(self.config_path, encoding="utf-8") as f:
                data = yaml.safe_load(f)
        except yaml.YAMLError as exc:
            return False, [f"YAML syntax error: {exc}"]

        errors = self._validate_with_jsonschema(data or {})
        return len(errors) == 0, errors

    def load(self, validate_schema: bool = True) -> Settings:
        """
        Load and validate the configuration.

        Resolves:
        - Environment variables: ${{ env.VAR }}
        - Secrets: ${{ secrets.VAR }}

        Args:
            validate_schema: If True, validate against JSON Schema before loading

        Returns:
            Validated Settings instance

        Raises:
            FileNotFoundError: If config file doesn't exist
            ValueError: If config is invalid or schema validation fails
        """
        try:
            logger.info("Loading config from %s", self.config_path.resolve())

            # Validate with JSON Schema first (if enabled)
            if validate_schema:
                is_valid, errors = self.validate_yaml_with_schema()
                if not is_valid:
                    error_msg = "\n".join(f"  - {e}" for e in errors[:10])  # Limit to 10 errors
                    if len(errors) > 10:
                        error_msg += f"\n  ... and {len(errors) - 10} more errors"
                    raise ValueError(
                        f"JSON Schema validation failed for {self.config_path}:\n{error_msg}"
                    )
                logger.debug("JSON Schema validation passed")

            # Load secrets if available
            secrets = self._load_secrets()

            # Load and validate settings with Pydantic
            settings = Settings.from_yaml(self.config_path, secrets=secrets)
            self._apply_endpoint_candidates(settings)
            self._apply_model_defaults(settings)
            self._normalize_storage_paths(settings)

            def _should_discover_ollama() -> bool:
                if settings.optional_services.ollama.enabled:
                    return True
                default_chat = settings.get_default_chat_model()
                default_embed = settings.get_default_embedding_model()
                return bool(
                    (default_chat and default_chat.provider == "ollama")
                    or (default_embed and default_embed.provider == "ollama")
                )

            if _should_discover_ollama():
                # Auto-discover Ollama models (non-fatal)
                try:
                    added = auto_discover_ollama(settings)
                    if added:
                        logger.info("Auto-discovered %d Ollama models", added)
                except Exception as exc:
                    logger.debug("Ollama auto-discovery skipped: %s", exc)

        except FileNotFoundError as exc:
            raise FileNotFoundError(f"Config file not found: {self.config_path}") from exc
        except ValidationError as exc:
            raise ValueError(
                f"Invalid YAML config at {self.config_path}:\n{exc}"
            ) from exc
        except ValueError:
            raise  # Re-raise ValueError from schema validation
        except Exception as exc:
            raise ValueError(
                f"Failed to load YAML config at {self.config_path}: {exc}"
            ) from exc

        self._settings = settings
        logger.info(
            "Loaded config '%s' v%s (schema: %s) from %s",
            settings.name,
            settings.version,
            settings.schema_version,
            self.config_path.resolve(),
        )
        return settings

    def reload(self) -> Settings:
        """Force reload the configuration."""
        self._settings = None
        self._secrets = None
        return self.load()

    def get(self) -> Settings:
        """Get current settings, loading if necessary."""
        if self._settings is None:
            return self.load()
        return self._settings

    def write_schema(self) -> Path:
        """
        Generate and write the JSON Schema file.

        The schema can be used for YAML editor validation:

            # yaml-language-server: $schema=./app.schema.gen.json

        Returns:
            Path to the generated schema file
        """
        schema = Settings.model_json_schema()

        # Add schema metadata
        schema["$schema"] = "http://json-schema.org/draft-07/schema#"
        schema["title"] = "Crystalith Configuration"
        schema["description"] = (
            "Configuration schema for Crystalith. "
            "Supports YAML anchors for reusable configurations and "
            "${{ env.VAR }} / ${{ secrets.VAR }} for variable interpolation."
        )

        self.schema_path.parent.mkdir(parents=True, exist_ok=True)
        self.schema_path.write_text(
            json.dumps(schema, ensure_ascii=False, indent=2) + "\n",
            encoding="utf-8",
        )

        logger.info("Generated schema at %s", self.schema_path.resolve())
        return self.schema_path

    def schema_reference(self) -> str:
        """Get relative path reference for schema in YAML."""
        reference_path = self.schema_path
        try:
            reference_path = self.schema_path.relative_to(self.config_path.parent)
        except ValueError:
            reference_path = self.schema_path

        reference = reference_path.as_posix()
        if not reference.startswith((".", "/")):
            return f"./{reference}"
        return reference

    def schema_comment(self) -> str:
        """Get YAML comment for schema reference."""
        return f"# yaml-language-server: $schema={self.schema_reference()}"

    def validate_config(self) -> list[str]:
        """
        Validate the configuration and return any warnings.

        Returns:
            List of warning messages (empty if all good)
        """
        warnings: list[str] = []
        settings = self.get()

        # Check for models without required provider config
        for model in settings.models.available:
            if model.provider == "openai":
                openai_settings = model.get_openai_config()
                if not openai_settings.api_key:
                    warnings.append(
                        f"Model '{model.id}' (openai) has no api_key in provider_config"
                    )
            elif model.provider == "ollama":
                ollama_settings = model.get_ollama_config()
                if not ollama_settings.host:
                    warnings.append(
                        f"Model '{model.id}' (ollama) has no host in provider_config"
                    )

        # Check for roles in available models
        chat_models = settings.models.get_models_by_role("chat")
        embed_models = settings.models.get_models_by_role("embed")

        if not chat_models:
            warnings.append("No models with 'chat' role found in models.available")
        if not embed_models:
            warnings.append("No models with 'embed' role found in models.available")

        return warnings

    def generate_example_config(self) -> str:
        """
        Generate an example configuration file with documentation.

        Returns:
            Example YAML configuration string
        """
        return '''\
# yaml-language-server: $schema=./app.schema.gen.json
# ============================================================================
# Crystalith Configuration
# ============================================================================
# This file supports:
# - YAML anchors for reusable configurations (recommended!)
# - Environment variables: ${{ env.VAR_NAME }}
# - Secrets: ${{ secrets.SECRET_NAME }} (requires secrets.yaml)
#
# YAML Version header enables advanced features like anchors:
%YAML 1.1
---
# Configuration metadata
name: "Crystalith"
version: "1.0.0"
schema: v1

# ============================================================================
# Providers (Define reusable provider configs with YAML anchors)
# ============================================================================
providers:
  # OpenAI-compatible API (can be OpenRouter, Azure, etc.)
  openai_main: &openai_main
    api_key: ${{ env.OPENAI_API_KEY }}
    base_url: "https://api.openai.com/v1"

  # Local proxy / OpenRouter
  openai_proxy: &openai_proxy
    api_key: ${{ env.OPENROUTER_API_KEY }}
    base_url: "http://localhost:50256/v1"

  # Local Ollama
  ollama_local: &ollama_local
    host: "http://localhost:11434"

# ============================================================================
# Models (Required)
# ============================================================================
models:
  # Default model selections
  defaults:
    chat: "gpt-4"
    embedding: "bge-m3-local"

  # Available models - each model must have a unique id
  available:
    # Cloud models via OpenAI API
    - id: "gpt-4"
      provider: "openai"
      model: "gpt-4"
      display_name: "GPT-4"
      description: "OpenAI GPT-4"
      roles: [chat, edit]
      capabilities: [tool_use, image_input]
      provider_config:
        <<: *openai_main
      completion_options:
        temperature: 0.7
        max_tokens: 4096
      request_options:
        timeout: 30
        headers:
          X-Crystalith-Client: "crystalith"

    # Via proxy (e.g., OpenRouter)
    - id: "claude-3-sonnet"
      provider: "openai"
      model: "anthropic/claude-3-sonnet"
      display_name: "Claude 3 Sonnet"
      description: "Anthropic Claude via OpenRouter"
      roles: [chat, edit]
      capabilities: [tool_use]
      provider_config:
        <<: *openai_proxy

    # Local embedding model
    - id: "bge-m3-local"
      provider: "ollama"
      model: "bge-m3:567m"
      display_name: "BGE-M3 (Local)"
      description: "Local embedding model"
      roles: [embed]
      provider_config:
        <<: *ollama_local
      ollama_options:
        num_ctx: 32768
        num_batch: 256
        mlock: true

    # Local chat model
    - id: "qwen-local"
      provider: "ollama"
      model: "qwen2.5:7b"
      display_name: "Qwen 2.5 (Local)"
      description: "Local chat model, no network required"
      roles: [chat]
      provider_config:
        <<: *ollama_local

# ============================================================================
# Feature Settings
# ============================================================================
embedding:
  chunk_size: 512
  batch_size: 32

# ============================================================================
# Storage
# ============================================================================
vector_storage:
  provider: "chroma"
  chroma:
    path: "./data/chroma"
    telemetry: false
  sqlite:
    path: "./data/vectors.db"

database:
  url: "sqlite+aiosqlite:///./data/app.db"

# ============================================================================
# Context Window
# ============================================================================
context_window:
  max_tokens: 8000
  compression_strategy: "truncate"
  window_size: 10
  priority:
    - history
    - retrieval
    - recent
    - system
'''
