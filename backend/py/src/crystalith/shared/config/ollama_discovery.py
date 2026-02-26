"""Ollama model auto-discovery.

Queries a running Ollama server for available models and creates
ModelConfig entries for any models not already defined in the config.

This allows users to use any Ollama model by simply pulling it,
without needing to manually add it to config/app.yaml.
"""

from __future__ import annotations

import logging
import os
from typing import Any

import httpx

from .models import ModelConfig, OllamaProviderSettings, Settings

logger = logging.getLogger(__name__)

_FALLBACK_OLLAMA_HOSTS: tuple[str, ...] = (
    "http://127.0.0.1:11434",
    "http://localhost:11434",
)

# Embedding model families (models in these families get the "embed" role)
_EMBEDDING_FAMILIES = frozenset({
    "bert", "nomic-bert", "nomic-embed", "bge", "e5", "gte",
    "mxbai-embed", "snowflake-arctic-embed", "all-minilm",
})

# Known embedding model name prefixes
_EMBEDDING_NAME_PREFIXES = (
    "bge-", "nomic-embed", "mxbai-embed", "snowflake-arctic",
    "all-minilm", "e5-", "gte-", "jina-embeddings",
    "text-embedding",
)


def _is_embedding_model(name: str, family: str | None = None) -> bool:
    """Heuristic to determine if a model is an embedding model."""
    if family and family.lower() in _EMBEDDING_FAMILIES:
        return True
    name_lower = name.lower().split(":")[0]  # strip tag
    # Check known prefixes
    for prefix in _EMBEDDING_NAME_PREFIXES:
        if prefix in name_lower:
            return True
    return False


def _model_display_name(name: str) -> str:
    """Generate a human-friendly display name from an Ollama model name."""
    # For HuggingFace models like "hf.co/unsloth/Qwen3-8B-GGUF:UD-Q4_K_XL"
    if name.startswith("hf.co/"):
        parts = name.split("/")
        if len(parts) >= 3:
            # Use the last path segment (may include :tag)
            model_part = "/".join(parts[2:])
            # Split off the GGUF suffix for cleaner display
            base = model_part.split(":")[0]
            tag = ""
            if ":" in model_part:
                tag = ":" + model_part.split(":")[-1]
            # Remove common suffixes like -GGUF for cleaner display
            clean_base = base.replace("-GGUF", "").replace("-gguf", "")
            return f"{clean_base}{tag}"

    # For standard models like "qwen2.5-coder:1.5b"
    base = name.split(":")[0]
    tag = ""
    if ":" in name:
        tag = ":" + name.split(":")[-1]
    return f"{base}{tag}"


def _sanitize_model_id(name: str) -> str:
    """Create a valid model ID from an Ollama model name.

    The ID is used as a unique identifier in the config system.
    We prefix with 'ollama:' to avoid collisions with manually configured models.
    """
    return f"ollama:{name}"


def discover_ollama_models(
    host: str = "http://localhost:11434",
    *,
    timeout: float = 5.0,
) -> list[dict[str, Any]]:
    """Query Ollama server for available models.

    Returns raw model data from the Ollama API.
    Returns an empty list if the server is unreachable.
    """
    try:
        with httpx.Client(timeout=timeout) as client:
            resp = client.get(f"{host}/api/tags")
            resp.raise_for_status()
            data = resp.json()
            return data.get("models", [])
    except Exception as exc:
        logger.debug("Ollama discovery failed for %s: %s", host, exc)
        return []


def collect_ollama_hosts(
    settings: Settings,
    *,
    include_env: bool = True,
    include_fallback: bool = True,
) -> set[str]:
    """Collect unique Ollama hosts from settings and optional environment."""
    hosts: set[str] = set()

    for model in settings.models.available:
        if model.provider != "ollama":
            continue
        ollama_config = model.get_ollama_config()
        if ollama_config.host:
            hosts.add(ollama_config.host)

    if include_env:
        env_host = os.environ.get("OLLAMA_HOST")
        if env_host:
            hosts.add(env_host)

    if include_fallback:
        should_add_fallback = not hosts or any("host.docker.internal" in host for host in hosts)
        if should_add_fallback:
            hosts.update(_FALLBACK_OLLAMA_HOSTS)

    return hosts


def _collect_ollama_hosts_in_order(
    settings: Settings | None,
    *,
    preferred_host: str | None = None,
    include_env: bool,
    include_fallback: bool,
) -> list[str]:
    ordered_hosts: list[str] = []
    seen_hosts: set[str] = set()

    def _append(host: str | None) -> None:
        if not host:
            return
        normalized = host.strip()
        if not normalized or normalized in seen_hosts:
            return
        seen_hosts.add(normalized)
        ordered_hosts.append(normalized)

    _append(preferred_host)

    if settings is not None:
        for model in settings.models.available:
            if model.provider != "ollama":
                continue
            _append(model.get_ollama_config().host)

    if include_env:
        _append(os.environ.get("OLLAMA_HOST"))

    if include_fallback:
        for host in _FALLBACK_OLLAMA_HOSTS:
            _append(host)

    return ordered_hosts


def probe_ollama_host(
    host: str,
    *,
    timeout: float = 3.0,
) -> tuple[bool, str | None, int | None]:
    """Probe Ollama host health via /api/tags.

    Returns (healthy, error_message, model_count).
    """
    try:
        with httpx.Client(timeout=timeout) as client:
            resp = client.get(f"{host}/api/tags")
            resp.raise_for_status()
            data = resp.json()
        models = data.get("models", [])
        model_count = len(models) if isinstance(models, list) else None
        return True, None, model_count
    except Exception as exc:
        return False, str(exc), None


def resolve_reachable_ollama_host(
    *,
    preferred_host: str | None = None,
    settings: Settings | None = None,
    timeout: float = 0.8,
    include_env: bool = True,
    include_fallback: bool = True,
) -> str:
    """Return the first healthy Ollama host from ordered candidates.

    If none are healthy, falls back to the preferred host, then localhost.
    """
    hosts = _collect_ollama_hosts_in_order(
        settings,
        preferred_host=preferred_host,
        include_env=include_env,
        include_fallback=include_fallback,
    )

    if not hosts:
        return _FALLBACK_OLLAMA_HOSTS[0]

    probe_timeout = max(0.1, timeout)
    for host in hosts:
        healthy, _, _ = probe_ollama_host(host, timeout=probe_timeout)
        if healthy:
            return host

    preferred = (preferred_host or "").strip()
    if preferred:
        return preferred
    return hosts[0]


def build_model_configs_from_ollama(
    ollama_models: list[dict[str, Any]],
    host: str = "http://localhost:11434",
) -> list[ModelConfig]:
    """Convert raw Ollama model data to ModelConfig instances."""
    configs: list[ModelConfig] = []

    for model_data in ollama_models:
        name: str = model_data.get("name", "")
        if not name:
            continue

        details = model_data.get("details", {})
        family = details.get("family", "")
        param_size = details.get("parameter_size", "")

        is_embed = _is_embedding_model(name, family)
        roles: list[str] = ["embed"] if is_embed else ["chat"]

        display_name = _model_display_name(name)
        description = f"Ollama · {family}" if family else "Ollama model"
        if param_size:
            description += f" · {param_size}"

        config = ModelConfig(
            id=_sanitize_model_id(name),
            provider="ollama",
            model=name,
            display_name=display_name,
            description=description,
            roles=roles,  # type: ignore[arg-type]
            capabilities=[],
            provider_config=OllamaProviderSettings(host=host),
        )
        configs.append(config)

    return configs


def merge_discovered_models(settings: Settings, discovered: list[ModelConfig]) -> int:
    """Merge discovered Ollama models into settings, skipping duplicates.

    A model is considered a duplicate if:
    - Its ID already exists in settings.models.available, OR
    - A model with the same provider='ollama' and same model name already exists

    Returns the number of newly added models.
    """
    existing_ids = {m.id for m in settings.models.available}
    existing_ollama_models = {
        m.model
        for m in settings.models.available
        if m.provider == "ollama"
    }

    added = 0
    for config in discovered:
        if config.id in existing_ids:
            continue
        if config.model in existing_ollama_models:
            continue
        settings.models.available.append(config)
        existing_ids.add(config.id)
        existing_ollama_models.add(config.model)
        added += 1

    return added


def auto_discover_ollama(settings: Settings) -> int:
    """Auto-discover and register Ollama models into settings.

    Finds all Ollama hosts configured in the settings and queries each
    for available models. Newly discovered models are added to
    settings.models.available.

    Returns the total number of newly added models.
    """
    hosts = collect_ollama_hosts(settings, include_env=True, include_fallback=True)

    total_added = 0
    for host in hosts:
        raw_models = discover_ollama_models(host)
        if raw_models:
            configs = build_model_configs_from_ollama(raw_models, host=host)
            added = merge_discovered_models(settings, configs)
            if added:
                logger.info(
                    "Discovered %d new Ollama models from %s",
                    added,
                    host,
                )
            total_added += added

    return total_added
