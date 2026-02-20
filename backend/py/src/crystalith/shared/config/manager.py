from __future__ import annotations

import json
import logging
import os
from pathlib import Path
from typing import Any

import yaml
from jsonschema import Draft7Validator, ValidationError as JsonSchemaValidationError
from pydantic import ValidationError

from .models import OllamaProviderSettings, OpenAIProviderSettings, Settings
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
            schema_path: Path to write JSON schema (defaults to config/app.schema.json)
            secrets_path: Optional path to secrets YAML file
        """
        self.config_path = config_path
        self.schema_path = schema_path or Path("config/app.schema.json")
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

        if self.secrets_path is None or not self.secrets_path.is_file():
            if self.secrets_path is not None and self.secrets_path.is_dir():
                secrets: dict[str, str] = {}
                for item in self.secrets_path.iterdir():
                    if not item.is_file():
                        continue
                    try:
                        secrets[item.name] = item.read_text(encoding="utf-8").strip()
                    except Exception as exc:
                        logger.warning("Failed to read secret %s: %s", item, exc)
                self._secrets = secrets
                logger.info("Loaded %d docker secrets from %s", len(secrets), self.secrets_path.resolve())
                return self._secrets

            self._secrets = {}
            return self._secrets

        try:
            with open(self.secrets_path, encoding="utf-8") as f:
                data = yaml.safe_load(f)
                self._secrets = {str(k): str(v) for k, v in (data or {}).items()}
                logger.info("Loaded secrets from %s", self.secrets_path.resolve())
        except Exception as exc:
            logger.warning("Failed to load secrets from %s: %s", self.secrets_path, exc)
            self._secrets = {}

        return self._secrets

    def _apply_env_overrides(self, settings: Settings, secrets: dict[str, str]) -> None:
        def _read_text(*names: str) -> str | None:
            for name in names:
                value = os.environ.get(name)
                if value is None:
                    continue
                text = value.strip()
                if text:
                    return text
            return None

        def _read_text_with_secrets(*names: str) -> str | None:
            value = _read_text(*names)
            if value:
                return value
            for name in names:
                secret_value = secrets.get(name)
                if secret_value:
                    return secret_value.strip() or None
            return None

        def _read_int(*names: str) -> int | None:
            value = _read_text(*names)
            if value is None:
                return None
            try:
                return int(value)
            except ValueError:
                logger.warning("Invalid int for %s: %s", names[0], value)
                return None

        database_url = _read_text("DATABASE_URL", "CRYSTALITH_DATABASE__URL")
        if database_url:
            settings.database.url = database_url

        chroma_host = _read_text(
            "CHROMA_HOST",
            "CRYSTALITH_VECTOR_STORAGE__CHROMA__HOST",
        )
        if chroma_host:
            settings.vector_storage.chroma.host = chroma_host

        chroma_port = _read_int(
            "CHROMA_PORT",
            "CRYSTALITH_VECTOR_STORAGE__CHROMA__PORT",
        )
        if chroma_port is not None:
            settings.vector_storage.chroma.port = chroma_port

        chroma_path = _read_text(
            "CHROMA_PATH",
            "CRYSTALITH_VECTOR_STORAGE__CHROMA__PATH",
        )
        if chroma_path:
            settings.vector_storage.chroma.path = chroma_path

        cache_provider = _read_text("CACHE_PROVIDER", "CRYSTALITH_CACHE__PROVIDER")
        redis_url = _read_text("REDIS_URL", "CRYSTALITH_CACHE__REDIS_URL")
        if cache_provider:
            normalized = cache_provider.strip().lower()
            if normalized in {"memory", "redis"}:
                settings.cache.provider = normalized  # type: ignore[assignment]
        if redis_url:
            settings.cache.redis_url = redis_url
            # Only auto-promote to redis when no explicit CACHE_PROVIDER was set.
            # If the user explicitly chose "memory", respect that choice even if
            # REDIS_URL is pre-configured for later use.
            if not cache_provider and settings.cache.provider != "redis":
                settings.cache.provider = "redis"

        embedding_concurrency = _read_int("CRYSTALITH_CONCURRENCY__EMBEDDING")
        if embedding_concurrency is not None and embedding_concurrency >= 0:
            settings.concurrency.embedding = embedding_concurrency

        vector_search_concurrency = _read_int("CRYSTALITH_CONCURRENCY__VECTOR_SEARCH")
        if vector_search_concurrency is not None and vector_search_concurrency >= 0:
            settings.concurrency.vector_search = vector_search_concurrency

        llm_concurrency = _read_int("CRYSTALITH_CONCURRENCY__LLM_GENERATE")
        if llm_concurrency is not None and llm_concurrency >= 0:
            settings.concurrency.llm_generate = llm_concurrency

        openai_api_key = _read_text_with_secrets("OPENAI_API_KEY")
        openai_base_url = _read_text("OPENAI_BASE_URL")
        if openai_api_key or openai_base_url:
            for model in settings.models.available:
                if model.provider != "openai":
                    continue
                if isinstance(model.provider_config, OpenAIProviderSettings):
                    if openai_api_key:
                        model.provider_config.api_key = openai_api_key
                    if openai_base_url:
                        model.provider_config.base_url = openai_base_url
                elif isinstance(model.provider_config, dict):
                    if openai_api_key:
                        model.provider_config["api_key"] = openai_api_key
                    if openai_base_url:
                        model.provider_config["base_url"] = openai_base_url
                else:
                    config: dict[str, Any] = {}
                    if openai_api_key:
                        config["api_key"] = openai_api_key
                    if openai_base_url:
                        config["base_url"] = openai_base_url
                    model.provider_config = config

        ollama_host = _read_text("OLLAMA_HOST")
        if ollama_host:
            for model in settings.models.available:
                if model.provider != "ollama":
                    continue
                if isinstance(model.provider_config, OllamaProviderSettings):
                    model.provider_config.host = ollama_host
                elif isinstance(model.provider_config, dict):
                    model.provider_config["host"] = ollama_host
                else:
                    model.provider_config = {"host": ollama_host}

        available_ids = [m.id for m in settings.models.available]

        default_chat_model = _read_text("CRYSTALITH_DEFAULT_CHAT_MODEL", "DEFAULT_CHAT_MODEL")
        if default_chat_model:
            if settings.models.get_model(default_chat_model) is None:
                raise ValueError(
                    f"Invalid default chat model id: {default_chat_model!r}. "
                    f"Available model ids: {available_ids}. "
                    f"Hint: use the model 'id' from config/app.yaml, not the raw provider model name."
                )
            settings.models.defaults.chat = default_chat_model

        default_embedding_model = _read_text("CRYSTALITH_DEFAULT_EMBEDDING_MODEL", "DEFAULT_EMBEDDING_MODEL")
        if default_embedding_model:
            if settings.models.get_model(default_embedding_model) is None:
                raise ValueError(
                    f"Invalid default embedding model id: {default_embedding_model!r}. "
                    f"Available model ids: {available_ids}. "
                    f"Hint: use the model 'id' from config/app.yaml, not the raw provider model name."
                )
            settings.models.defaults.embedding = default_embedding_model

    def _validate_with_jsonschema(self, data: dict[str, Any]) -> list[str]:
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
            self._apply_env_overrides(settings, secrets)

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

            # yaml-language-server: $schema=./app.schema.json

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
            json.dumps(schema, ensure_ascii=False, indent=2),
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
# yaml-language-server: $schema=./app.schema.json
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
