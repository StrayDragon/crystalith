from __future__ import annotations

import os
from dataclasses import dataclass
from typing import Literal

EnvVarType = Literal["bool", "int", "float", "str", "path", "enum"]


@dataclass(frozen=True, slots=True)
class EnvVarDoc:
    name: str
    type: EnvVarType
    default: str | int | float | bool | None
    description: str


# -----------------------------------------------------------------------------
# Supported env var names (SSOT)
# -----------------------------------------------------------------------------

# Configuration location
CRYSTALITH_CONFIG_PATH = "CRYSTALITH_CONFIG_PATH"
CRYSTALITH_CONFIG_DIR = "CRYSTALITH_CONFIG_DIR"
CRYSTALITH_SECRETS_PATH = "CRYSTALITH_SECRETS_PATH"

# Local data directory (non-DB artifacts, vectors, slide previews, etc.)
CRYSTALITH_DATA_DIR = "CRYSTALITH_DATA_DIR"

# Optional-services runtime monitor (dependency health probing)
CRYSTALITH_OPTIONAL_SERVICES_MONITOR_ENABLED = "CRYSTALITH_OPTIONAL_SERVICES_MONITOR_ENABLED"
CRYSTALITH_OPTIONAL_SERVICES_MONITOR_INTERVAL_S = "CRYSTALITH_OPTIONAL_SERVICES_MONITOR_INTERVAL_S"
CRYSTALITH_OPTIONAL_SERVICES_MONITOR_TIMEOUT_S = "CRYSTALITH_OPTIONAL_SERVICES_MONITOR_TIMEOUT_S"

# Embedding cache tuning (Redis-only)
CRYSTALITH_EMBEDDING_CACHE_ENABLED = "CRYSTALITH_EMBEDDING_CACHE_ENABLED"
CRYSTALITH_EMBEDDING_CACHE_TTL_S = "CRYSTALITH_EMBEDDING_CACHE_TTL_S"
CRYSTALITH_EMBEDDING_CACHE_MAX_TEXTS = "CRYSTALITH_EMBEDDING_CACHE_MAX_TEXTS"
CRYSTALITH_EMBEDDING_CACHE_MAX_CHARS = "CRYSTALITH_EMBEDDING_CACHE_MAX_CHARS"

# Retrieval tuning / debugging
CRYSTALITH_RETRIEVAL_MULTI_QUERY = "CRYSTALITH_RETRIEVAL_MULTI_QUERY"
CRYSTALITH_RETRIEVAL_FUSION_STRATEGY = "CRYSTALITH_RETRIEVAL_FUSION_STRATEGY"
CRYSTALITH_RETRIEVAL_ASSEMBLY_CACHE = "CRYSTALITH_RETRIEVAL_ASSEMBLY_CACHE"
CRYSTALITH_RETRIEVAL_ASSEMBLY_CACHE_TTL_S = "CRYSTALITH_RETRIEVAL_ASSEMBLY_CACHE_TTL_S"

# Observability / debugging
CRYSTALITH_OBSERVABILITY_SSE_TIMINGS = "CRYSTALITH_OBSERVABILITY_SSE_TIMINGS"

# Output repair (best-effort)
CRYSTALITH_OUTPUT_REPAIR = "CRYSTALITH_OUTPUT_REPAIR"


# -----------------------------------------------------------------------------
# Supported defaults (SSOT)
# -----------------------------------------------------------------------------

OPTIONAL_SERVICES_MONITOR_ENABLED_DEFAULT = True
OPTIONAL_SERVICES_MONITOR_INTERVAL_S_DEFAULT = 15.0
OPTIONAL_SERVICES_MONITOR_TIMEOUT_S_DEFAULT = 3.0

EMBEDDING_CACHE_ENABLED_DEFAULT = True
EMBEDDING_CACHE_TTL_S_DEFAULT = 600.0
EMBEDDING_CACHE_MAX_TEXTS_DEFAULT = 8
EMBEDDING_CACHE_MAX_CHARS_DEFAULT = 2000

RETRIEVAL_FUSION_STRATEGY_DEFAULT = "rrf"
RETRIEVAL_ASSEMBLY_CACHE_ENABLED_DEFAULT = False
RETRIEVAL_ASSEMBLY_CACHE_TTL_S_DEFAULT = 20.0

OBSERVABILITY_SSE_TIMINGS_DEFAULT = False
OUTPUT_REPAIR_DEFAULT = False


ENV_VAR_DOCS: list[EnvVarDoc] = [
    EnvVarDoc(
        name=CRYSTALITH_CONFIG_PATH,
        type="path",
        default=None,
        description="Path to the runtime config YAML file (overrides CRYSTALITH_CONFIG_DIR auto-discovery).",
    ),
    EnvVarDoc(
        name=CRYSTALITH_CONFIG_DIR,
        type="path",
        default=None,
        description="Directory containing app.yaml (used when CRYSTALITH_CONFIG_PATH is unset).",
    ),
    EnvVarDoc(
        name=CRYSTALITH_SECRETS_PATH,
        type="path",
        default=None,
        description="Path to secrets YAML or a Docker-secrets directory (auto-discovery is used when unset).",
    ),
    EnvVarDoc(
        name=CRYSTALITH_DATA_DIR,
        type="path",
        default=None,
        description="Override the data directory (defaults to <repo_root>/data or ./data depending on context).",
    ),
    EnvVarDoc(
        name=CRYSTALITH_OPTIONAL_SERVICES_MONITOR_ENABLED,
        type="bool",
        default=OPTIONAL_SERVICES_MONITOR_ENABLED_DEFAULT,
        description="Enable background optional-services probing used by /health/dependencies.",
    ),
    EnvVarDoc(
        name=CRYSTALITH_OPTIONAL_SERVICES_MONITOR_INTERVAL_S,
        type="float",
        default=OPTIONAL_SERVICES_MONITOR_INTERVAL_S_DEFAULT,
        description="Optional-services monitor probe interval (seconds).",
    ),
    EnvVarDoc(
        name=CRYSTALITH_OPTIONAL_SERVICES_MONITOR_TIMEOUT_S,
        type="float",
        default=OPTIONAL_SERVICES_MONITOR_TIMEOUT_S_DEFAULT,
        description="Optional-services monitor probe timeout (seconds).",
    ),
    EnvVarDoc(
        name=CRYSTALITH_EMBEDDING_CACHE_ENABLED,
        type="bool",
        default=EMBEDDING_CACHE_ENABLED_DEFAULT,
        description="Enable Redis embedding cache when cache.provider=redis (small-batch optimization).",
    ),
    EnvVarDoc(
        name=CRYSTALITH_EMBEDDING_CACHE_TTL_S,
        type="float",
        default=EMBEDDING_CACHE_TTL_S_DEFAULT,
        description="Redis embedding cache TTL (seconds).",
    ),
    EnvVarDoc(
        name=CRYSTALITH_EMBEDDING_CACHE_MAX_TEXTS,
        type="int",
        default=EMBEDDING_CACHE_MAX_TEXTS_DEFAULT,
        description="Max texts per embedding-cache key (safety/perf limit).",
    ),
    EnvVarDoc(
        name=CRYSTALITH_EMBEDDING_CACHE_MAX_CHARS,
        type="int",
        default=EMBEDDING_CACHE_MAX_CHARS_DEFAULT,
        description="Max characters per text eligible for embedding cache.",
    ),
    EnvVarDoc(
        name=CRYSTALITH_RETRIEVAL_MULTI_QUERY,
        type="bool",
        default=None,
        description="Force multi-query retrieval on/off (unset uses per-request tuning/config).",
    ),
    EnvVarDoc(
        name=CRYSTALITH_RETRIEVAL_FUSION_STRATEGY,
        type="enum",
        default=RETRIEVAL_FUSION_STRATEGY_DEFAULT,
        description="Retrieval fusion strategy: rrf|max_score (invalid values fall back to rrf).",
    ),
    EnvVarDoc(
        name=CRYSTALITH_RETRIEVAL_ASSEMBLY_CACHE,
        type="bool",
        default=RETRIEVAL_ASSEMBLY_CACHE_ENABLED_DEFAULT,
        description="Enable retrieval assembly cache (requires a cache provider, e.g. Redis).",
    ),
    EnvVarDoc(
        name=CRYSTALITH_RETRIEVAL_ASSEMBLY_CACHE_TTL_S,
        type="float",
        default=RETRIEVAL_ASSEMBLY_CACHE_TTL_S_DEFAULT,
        description="Retrieval assembly cache TTL (seconds).",
    ),
    EnvVarDoc(
        name=CRYSTALITH_OBSERVABILITY_SSE_TIMINGS,
        type="bool",
        default=OBSERVABILITY_SSE_TIMINGS_DEFAULT,
        description="Include timings in SSE events (debug/diagnostics).",
    ),
    EnvVarDoc(
        name=CRYSTALITH_OUTPUT_REPAIR,
        type="bool",
        default=OUTPUT_REPAIR_DEFAULT,
        description="Enable best-effort output repair pass for quality preference (advanced).",
    ),
]


# -----------------------------------------------------------------------------
# Parsing helpers
# -----------------------------------------------------------------------------


def env_bool(name: str, default: bool = False) -> bool:
    value = os.getenv(name)
    if value is None:
        return bool(default)
    return value.strip().lower() not in {"0", "false", "no", "off"}


def env_bool_optional(name: str) -> bool | None:
    value = os.getenv(name)
    if value is None:
        return None
    return value.strip().lower() not in {"0", "false", "no", "off"}


def env_int(name: str, default: int) -> int:
    raw = os.getenv(name)
    if raw is None:
        return int(default)
    try:
        return int(raw.strip())
    except (TypeError, ValueError):
        return int(default)


def env_float(name: str, default: float) -> float:
    raw = os.getenv(name)
    if raw is None:
        return float(default)
    try:
        return float(raw.strip())
    except (TypeError, ValueError):
        return float(default)
