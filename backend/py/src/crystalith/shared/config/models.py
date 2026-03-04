from __future__ import annotations

import os
import re
import ipaddress
from pathlib import Path
from collections.abc import Callable
from typing import Literal, cast

from pydantic import BaseModel, Field, field_validator, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic_settings.sources import YamlConfigSettingsSource

from crystalith.shared.json_types import JsonValue


# =============================================================================
# Secrets / Environment Variable Resolution
# =============================================================================

_VAR_PATTERN = re.compile(r"\$\{\{\s*(env|secrets)\.(\w+)\s*\}\}")


def _default_factory[T](factory: type[T]) -> Callable[[], T]:
    return cast(Callable[[], T], factory)


def resolve_variables(value: JsonValue, secrets: dict[str, str] | None = None) -> JsonValue:
    """
    Resolve ${{ env.VAR }} and ${{ secrets.VAR }} in string values.

    - ${{ env.VAR }} resolves to os.environ.get("VAR")
    - ${{ secrets.VAR }} resolves to secrets.get("VAR")

    Supports nested dicts and lists.
    """
    if isinstance(value, str):
        def replacer(match: re.Match[str]) -> str:
            source = match.group(1)
            var_name = match.group(2)
            if source == "env":
                return os.environ.get(var_name, "")
            elif source == "secrets" and secrets:
                return secrets.get(var_name, "")
            return ""
        return _VAR_PATTERN.sub(replacer, value)
    if isinstance(value, dict):
        return {k: resolve_variables(v, secrets) for k, v in value.items()}
    if isinstance(value, list):
        return [resolve_variables(item, secrets) for item in value]
    return value


# =============================================================================
# Provider Settings (can be referenced via YAML anchors)
# =============================================================================

class OpenAIProviderSettings(BaseModel):
    """OpenAI-compatible provider settings."""
    api_key: str | None = None
    base_url: str | None = None
    organization: str | None = None
    project: str | None = None


class OllamaProviderSettings(BaseModel):
    """Ollama provider settings."""
    host: str = "http://localhost:11434"


class ProvidersSettings(BaseModel):
    """
    Reusable provider configurations.

    Define providers here and reference them in model configs using YAML anchors.

    Example:
        providers:
          openai_main: &openai_main
            api_key: ${{ env.OPENAI_API_KEY }}
            base_url: "https://api.openai.com/v1"

          ollama_local: &ollama_local
            host: "http://localhost:11434"

        models:
          available:
            - id: "gpt-4"
              provider_config:
                <<: *openai_main
    """
    # Dynamic dict to allow any named provider
    model_config = {"extra": "allow"}


# =============================================================================
# Ollama Runtime Options
# =============================================================================

class OllamaRuntimeOptions(BaseModel):
    """Ollama model runtime options."""
    num_ctx: int | None = None
    num_thread: int | Literal["auto"] | None = None
    temperature: float | None = None
    num_batch: int | None = None
    mlock: bool | None = None
    numa: bool | None = None
    low_vram: bool | None = None

    def to_options(self) -> dict[str, JsonValue] | None:
        data = cast(dict[str, JsonValue], self.model_dump(exclude_none=True))
        if data.get("num_thread") == "auto":
            data.pop("num_thread", None)
        return data or None


# =============================================================================
# Completion Options (Continue-style)
# =============================================================================

class CompletionOptions(BaseModel):
    """
    Default completion options for model inference.

    Similar to Continue's defaultCompletionOptions.
    """
    context_length: int | None = Field(None, description="Maximum context length (tokens)")
    max_tokens: int | None = Field(None, description="Maximum tokens to generate")
    temperature: float | None = Field(None, ge=0.0, le=2.0, description="Sampling temperature")
    top_p: float | None = Field(None, ge=0.0, le=1.0, description="Nucleus sampling probability")
    top_k: int | None = Field(None, ge=0, description="Top-k sampling")
    stop: list[str] | None = Field(None, description="Stop sequences")
    reasoning: bool | None = Field(None, description="Enable reasoning/thinking mode")


class RequestOptions(BaseModel):
    """HTTP request options for model API calls."""
    timeout: int | None = Field(None, description="Request timeout in seconds")
    verify_ssl: bool = Field(True, description="Verify SSL certificates")
    proxy: str | None = Field(None, description="Proxy URL")
    headers: dict[str, str] | None = Field(None, description="Custom headers")


# =============================================================================
# Model Configuration (Continue-inspired)
# =============================================================================

# Model roles (what the model can do)
ModelRole = Literal["chat", "embed", "edit", "apply", "autocomplete", "summarize"]

# Model capabilities (special features)
ModelCapability = Literal["tool_use", "image_input", "audio_input", "streaming"]


class ModelConfig(BaseModel):
    """
    Configuration for a single AI model.

    Inspired by Continue's model configuration with enhancements for Crystalith.

    Example:
        - id: "gpt-5.2"
          provider: "openai"
          model: "gpt-5.2"
          display_name: "GPT-5.2"
          description: "Latest OpenAI model"
          roles: [chat, edit]
          capabilities: [tool_use, image_input]
          provider_config:
            <<: *openai_main
          completion_options:
            temperature: 0.7
            max_tokens: 4096
    """
    id: str = Field(..., description="Unique identifier for the model")
    provider: str = Field(..., description="Provider id (built-in: openai/ollama, or a plugin provider id)")
    model: str = Field(..., description="Model name/identifier used by the provider")
    display_name: str = Field(..., description="Human-readable display name")
    description: str = Field("", description="Optional description")

    # Roles (Continue-style) - what the model can be used for
    roles: list[ModelRole] = Field(
        default_factory=lambda: ["chat"],
        description="Roles this model can fulfill: chat, embed, edit, apply, autocomplete, summarize",
    )

    # Capabilities (Continue-style) - special features
    capabilities: list[ModelCapability | Literal["chat", "embedding"]] = Field(
        default_factory=list,
        description="Special capabilities: tool_use, image_input, audio_input, streaming",
    )

    # Provider-specific config (can use YAML anchors)
    provider_config: OpenAIProviderSettings | OllamaProviderSettings | dict[str, JsonValue] | None = Field(
        default=None,
        description="Provider-specific configuration (can reference providers via anchors)",
    )

    # Completion options
    completion_options: CompletionOptions | None = Field(
        default=None,
        description="Default completion options for this model",
    )

    # Ollama-specific options
    ollama_options: OllamaRuntimeOptions | None = Field(
        default=None,
        description="Ollama-specific runtime options",
    )

    # Request options
    request_options: RequestOptions | None = Field(
        default=None,
        description="HTTP request options",
    )

    @field_validator("capabilities", mode="before")
    @classmethod
    def normalize_capabilities(cls, v: list[str] | None) -> list[str]:
        """Normalize legacy 'chat'/'embedding' to roles-compatible format."""
        if v is None:
            return []
        return v

    def has_role(self, role: ModelRole) -> bool:
        """Check if model has a specific role."""
        return role in self.roles

    def has_capability(self, cap: str) -> bool:
        """Check if model has a specific capability."""
        # Also check legacy capabilities
        if cap == "chat":
            return "chat" in self.roles or "chat" in self.capabilities
        if cap == "embedding":
            return "embed" in self.roles or "embedding" in self.capabilities
        return cap in self.capabilities

    def get_openai_config(self) -> OpenAIProviderSettings:
        """Extract OpenAI provider config."""
        if isinstance(self.provider_config, OpenAIProviderSettings):
            return self.provider_config
        elif isinstance(self.provider_config, dict):
            return OpenAIProviderSettings.model_validate(self.provider_config)
        return OpenAIProviderSettings()

    def get_ollama_config(self) -> OllamaProviderSettings:
        """Extract Ollama provider config."""
        if isinstance(self.provider_config, OllamaProviderSettings):
            return self.provider_config
        elif isinstance(self.provider_config, dict):
            return OllamaProviderSettings.model_validate(self.provider_config)
        return OllamaProviderSettings()


class ModelDefaults(BaseModel):
    """Default model selections."""
    chat: str | None = Field(None, description="Default model ID for chat/generation")
    embedding: str | None = Field(None, description="Default model ID for embeddings")
    edit: str | None = Field(None, description="Default model ID for code editing")
    autocomplete: str | None = Field(None, description="Default model ID for autocomplete")


class ModelsSettings(BaseModel):
    """
    Multi-model configuration settings.

    All models must be defined in `available` list with unique IDs.
    Use `defaults` to specify which model to use for each role.

    Example:
        models:
          defaults:
            chat: "gpt-5.2"
            embedding: "bge-m3-local"
          available:
            - id: "gpt-5.2"
              provider: "openai"
              model: "gpt-5.2"
              roles: [chat, edit]
    """
    defaults: ModelDefaults = Field(default_factory=_default_factory(ModelDefaults))
    available: list[ModelConfig] = Field(default_factory=list)

    @model_validator(mode="after")
    def validate_defaults(self) -> ModelsSettings:
        """Validate that default model IDs exist in available models."""
        available_ids = {m.id for m in self.available}

        if self.defaults.chat and self.defaults.chat not in available_ids:
            raise ValueError(
                f"Default chat model '{self.defaults.chat}' not found in models.available. "
                f"Available: {sorted(available_ids)}"
            )
        if self.defaults.embedding and self.defaults.embedding not in available_ids:
            raise ValueError(
                f"Default embedding model '{self.defaults.embedding}' not found in models.available. "
                f"Available: {sorted(available_ids)}"
            )
        if self.defaults.edit and self.defaults.edit not in available_ids:
            raise ValueError(
                f"Default edit model '{self.defaults.edit}' not found in models.available. "
                f"Available: {sorted(available_ids)}"
            )
        if self.defaults.autocomplete and self.defaults.autocomplete not in available_ids:
            raise ValueError(
                f"Default autocomplete model '{self.defaults.autocomplete}' not found in models.available. "
                f"Available: {sorted(available_ids)}"
            )
        return self

    def get_model(self, model_id: str) -> ModelConfig | None:
        """Get model config by ID."""
        for model in self.available:
            if model.id == model_id:
                return model
        return None

    def get_models_by_role(self, role: ModelRole) -> list[ModelConfig]:
        """Get all models that support a specific role."""
        return [m for m in self.available if m.has_role(role)]

    def get_default_for_role(self, role: ModelRole) -> ModelConfig | None:
        """Get the default model for a role."""
        match role:
            case "chat":
                default_id = self.defaults.chat
            case "embed":
                default_id = self.defaults.embedding
            case "edit":
                default_id = self.defaults.edit
            case "autocomplete":
                default_id = self.defaults.autocomplete
            case _:
                default_id = None
        if default_id:
            return self.get_model(default_id)
        # Fallback to first model with this role
        models = self.get_models_by_role(role)
        return models[0] if models else None


# =============================================================================
# Feature Settings
# =============================================================================

class AppAuthSettings(BaseModel):
    """Optional API authentication settings for self-host deployments."""

    enabled: bool = Field(
        False,
        description="If true, require API key authentication for /v1 endpoints.",
    )
    api_key: str | None = Field(
        None,
        description=(
            "Shared API key used for 'Authorization: Bearer <token>'. "
            "Prefer injecting via ${{ env.* }} / ${{ secrets.* }}."
        ),
    )

    @model_validator(mode="after")
    def validate_api_key_required_when_enabled(self) -> AppAuthSettings:
        if self.enabled and not (self.api_key and self.api_key.strip()):
            raise ValueError("app.auth.enabled=true requires app.auth.api_key to be set")
        return self


class AppFeaturesSettings(BaseModel):
    """Application feature flags."""

    chat_prompt_presets_enabled: bool = Field(
        False,
        description="Enable /prompt:* directives in QA.",
    )
    chat_ui_envelope_enabled: bool = Field(
        False,
        description="Embed UI envelopes into assistant message content.",
    )
    workspace_frontend_bundles_enabled: bool = Field(
        True,
        description=(
            "If true, expose frontend bundle descriptors for workspace tools/outputs "
            "(enables interactive renderers in the web UI). Set false to force fallback rendering."
        ),
    )


class AppSettings(BaseModel):
    """Application settings."""
    name: str = "Crystalith"
    openapi_path: str = "/v1/codev/openapi.json"
    openapi_ui_path: str = "/v1/codev/openapi-ui/scalar"
    features: AppFeaturesSettings = Field(
        default_factory=lambda: AppFeaturesSettings.model_validate({}),
        description="Feature flags.",
    )
    auth: AppAuthSettings = Field(
        default_factory=lambda: AppAuthSettings.model_validate({}),
        description="Optional API authentication settings.",
    )
    cors: CorsSettings = Field(
        default_factory=lambda: CorsSettings.model_validate({}),
        description="CORS settings",
    )
    startup: StartupSettings = Field(
        default_factory=lambda: StartupSettings.model_validate({}),
        description="Startup behaviors",
    )


class CorsSettings(BaseModel):
    """CORS middleware settings for the API server."""

    allow_origins: list[str] = Field(
        default_factory=lambda: ["http://localhost:3000", "http://127.0.0.1:3000"],
        description="Allowed origins (empty list disables CORS middleware).",
    )
    allow_credentials: bool = Field(True, description="Whether to allow cookies/credentials.")
    allow_methods: list[str] = Field(default_factory=lambda: ["*"], description="Allowed methods.")
    allow_headers: list[str] = Field(default_factory=lambda: ["*"], description="Allowed headers.")


class StartupSettings(BaseModel):
    """Startup behaviors."""

    cleanup_failed_sources: bool = Field(
        False,
        description=(
            "If true, delete sources with status='failed' on backend startup. "
            "WARNING: this removes DB rows and may orphan related files/vectors."
        ),
    )


class DatabaseSettings(BaseModel):
    """Database settings."""
    url: str = "sqlite+aiosqlite:///./data/app.db"


class VectorStorageSQLiteSettings(BaseModel):
    """SQLite vector storage settings."""
    path: str = "./data/vectors.db"


class VectorStorageChromaSettings(BaseModel):
    """Chroma vector storage settings."""
    path: str = "./data/chroma"
    telemetry: bool = False
    host: str = "localhost"
    port: int = 8000


class VectorStorageSettings(BaseModel):
    """Vector storage settings."""
    provider: Literal["memory", "sqlite", "chroma"] = "chroma"
    sqlite: VectorStorageSQLiteSettings = Field(default_factory=_default_factory(VectorStorageSQLiteSettings))
    chroma: VectorStorageChromaSettings = Field(default_factory=_default_factory(VectorStorageChromaSettings))


class CacheSettings(BaseModel):
    """Cache settings."""

    provider: Literal["memory", "redis"] = "memory"
    ttl: int = Field(60, description="Default cache TTL in seconds (0 disables TTL)")
    max_size: int = Field(2048, description="Maximum number of cached keys for in-memory cache")
    redis_url: str | None = Field(None, description="Redis connection URL when provider=redis")

    @field_validator("ttl", "max_size")
    @classmethod
    def _non_negative(cls, value: int) -> int:
        if value < 0:
            raise ValueError("must be >= 0")
        return value

    @model_validator(mode="after")
    def _validate_redis_url(self) -> CacheSettings:
        if self.provider == "redis" and (self.redis_url is None or not self.redis_url.strip()):
            raise ValueError("redis_url is required when cache.provider is 'redis'")
        return self


class EmbeddingSettings(BaseModel):
    """
    Embedding settings.

    Use models.defaults.embedding to specify the default embedding model.
    This section only contains embedding-specific options.
    """
    chunk_size: int = Field(512, ge=64, description="Default chunk size for embedding")
    batch_size: int = Field(32, ge=1, description="Batch size for embedding requests")


class AISettings(BaseModel):
    """AI provider runtime settings."""

    timeout: int = Field(60, ge=1, le=600, description="Provider request timeout in seconds")
    max_retries: int = Field(3, ge=0, le=10, description="Maximum retries for retryable provider errors")


class ConcurrencySettings(BaseModel):
    """Stage-level concurrency guardrails for key I/O phases."""

    embedding: int = Field(
        8,
        ge=0,
        description=(
            "Max concurrent embedding calls (0 disables limiter). "
            "Applies to retrieval/QA/refine embedding stages."
        ),
    )
    vector_search: int = Field(
        8,
        ge=0,
        description="Max concurrent vector search calls (0 disables limiter).",
    )
    llm_generate: int = Field(
        4,
        ge=0,
        description="Max concurrent LLM generation calls (0 disables limiter).",
    )


class ChatSettings(BaseModel):
    """
    Chat settings.

    Use models.defaults.chat to specify the default chat model.
    This section only contains chat-specific options.
    """
    # Future: add chat-specific options like system prompt template, etc.


class RefineSettings(BaseModel):
    """Content refinement settings."""
    formats: list[str] = Field(default_factory=lambda: ["paragraph", "bullets", "structured"])


class ContextWindowSettings(BaseModel):
    """Context window management settings."""
    max_tokens: int = Field(8000, ge=1)
    compression_strategy: Literal["truncate", "summarize"] = "truncate"
    window_size: int = Field(10, ge=0)
    priority: list[Literal["history", "retrieval", "recent", "system"]] = Field(
        default_factory=lambda: ["history", "retrieval", "recent", "system"]
    )


class SearXNGSettings(BaseModel):
    """SearXNG search engine settings."""
    host: str = Field("", description="SearXNG instance URL. Empty disables web search.")
    api_key: str | None = Field(None, description="Optional API key for authentication")
    timeout: int = Field(10, ge=1, description="Request timeout in seconds")
    max_results: int = Field(10, ge=1, le=50, description="Maximum number of results")


class SearchSettings(BaseModel):
    """Web search settings."""
    searxng: SearXNGSettings = Field(default_factory=_default_factory(SearXNGSettings))


class OptionalServiceProbeSettings(BaseModel):
    """Probe settings for an optional dependency service."""

    enabled: bool = Field(True, description="Whether periodic probing is enabled")
    timeout_s: float = Field(3.0, ge=0.1, le=120, description="Probe timeout in seconds")
    interval_s: float = Field(15.0, ge=0.1, le=3600, description="Probe interval in seconds")
    path: str | None = Field(None, description="Optional HTTP probe path")


class OptionalServiceSettings(BaseModel):
    """Runtime contract for one optional dependency service."""

    enabled: bool = Field(False, description="Whether this optional service is enabled")
    endpoint: str | None = Field(None, description="Service endpoint/base URL")
    timeout_s: float = Field(3.0, ge=0.1, le=120, description="Connection timeout in seconds")
    probe: OptionalServiceProbeSettings = Field(
        default_factory=_default_factory(OptionalServiceProbeSettings),
        description="Probe policy for this service",
    )
    degrade_policy: Literal["core_available", "fail_closed"] = Field(
        "core_available",
        description="Degrade policy when dependency is unavailable",
    )


class OptionalServicesSettings(BaseModel):
    """Optional dependency service contracts."""

    ollama: OptionalServiceSettings = Field(
        default_factory=lambda: OptionalServiceSettings.model_validate(
            {"endpoint": "http://localhost:11434", "enabled": False}
        )
    )
    chroma: OptionalServiceSettings = Field(
        default_factory=lambda: OptionalServiceSettings.model_validate(
            {"endpoint": "http://localhost:8000", "enabled": False}
        )
    )
    redis: OptionalServiceSettings = Field(
        default_factory=lambda: OptionalServiceSettings.model_validate(
            {"endpoint": "redis://localhost:6379/0", "enabled": False}
        )
    )
    searxng: OptionalServiceSettings = Field(
        default_factory=lambda: OptionalServiceSettings.model_validate(
            {"endpoint": "http://localhost:8888", "enabled": False}
        )
    )


class PluginsSettings(BaseModel):
    """
    Plugin loading configuration.

    Plugins are discovered via Python entry points (group: `crystalith.plugins`).
    This section controls which discovered plugins are enabled.
    """

    enabled: list[str] | None = Field(
        None,
        description="If set, only plugins in this list are loaded (allowlist).",
    )
    disabled: list[str] = Field(
        default_factory=list,
        description="Plugins to skip loading (denylist).",
    )

    def is_enabled(self, plugin_id: str) -> bool:
        normalized = plugin_id.strip()
        if not normalized:
            return False

        if self.enabled:
            return normalized in set(self.enabled)

        return normalized not in set(self.disabled)


# =============================================================================
# HTTP Proxy Settings (YAML Anchor Support)
# =============================================================================

class HttpProxySettings(BaseModel):
    """
    HTTP 代理配置。

    支持 HTTP/HTTPS/SOCKS5 代理协议，可作为 YAML anchor 被其他功能引用。

    Example:
        proxy_settings: &default_proxy
          enabled: false
          http_url: "http://127.0.0.1:7890"
          https_url: "http://127.0.0.1:7890"
          socks5_url: null
          no_proxy: ["localhost", "127.0.0.1"]

        source_ingestion:
          url_fetch:
            proxy: *default_proxy
    """
    enabled: bool = Field(False, description="是否启用代理")
    http_url: str | None = Field(None, description="HTTP 代理 URL (例如 http://127.0.0.1:7890)")
    https_url: str | None = Field(None, description="HTTPS 代理 URL (可选，默认使用 http_url)")
    socks5_url: str | None = Field(None, description="SOCKS5 代理 URL (例如 socks5://127.0.0.1:1080)")
    no_proxy: list[str] = Field(
        default_factory=lambda: ["localhost", "127.0.0.1"],
        description="不走代理的域名/IP列表",
    )

    @field_validator("http_url", "https_url", "socks5_url", mode="before")
    @classmethod
    def validate_proxy_url(cls, v: str | None) -> str | None:
        if v is None or v == "":
            return None
        # 基本验证 URL 格式
        if not v.startswith(("http://", "https://", "socks5://")):
            raise ValueError(f"代理 URL 必须以 http://, https:// 或 socks5:// 开头: {v}")
        return v

    def get_proxy_url(self) -> str | None:
        """返回 httpx 兼容的代理 URL 字符串。"""
        if not self.enabled:
            return None

        # SOCKS5 优先
        if self.socks5_url:
            return self.socks5_url

        # HTTP/HTTPS 代理
        if self.http_url:
            return self.http_url

        return None

    def should_proxy(self, host: str) -> bool:
        """检查指定主机是否应该使用代理。"""
        if not self.enabled:
            return False

        # 检查 no_proxy 列表
        for no_proxy_host in self.no_proxy:
            if host == no_proxy_host or host.endswith(f".{no_proxy_host}"):
                return False

        return True


class UrlFetchSecuritySettings(BaseModel):
    """URL fetch SSRF 安全策略配置。"""

    allowlist_hosts: list[str] = Field(
        default_factory=list,
        description="显式允许的 host（精确匹配）。可用于受控环境下放行内部站点。",
    )
    allowlist_domains: list[str] = Field(
        default_factory=list,
        description="显式允许的域名后缀（example.com 将匹配 example.com 和 *.example.com）。",
    )
    allowlist_cidrs: list[str] = Field(
        default_factory=list,
        description="显式允许的 CIDR 网段（例如 10.0.0.0/8）。",
    )
    allowlist_only: bool = Field(
        False,
        description="仅允许 allowlist 命中的 URL（默认 false：允许公网，但拒绝 localhost/私网/元数据等高风险目标）。",
    )
    max_redirects: int = Field(
        5,
        ge=0,
        le=10,
        description="URL fetch 最大重定向跳数（逐跳重验 SSRF 安全策略）。",
    )

    @field_validator("allowlist_hosts", "allowlist_domains", mode="before")
    @classmethod
    def _normalize_allowlist_hosts_domains(cls, v: object) -> list[str]:
        if v is None or v == "":
            return []
        if not isinstance(v, list):
            raise TypeError("allowlist must be a list of strings")
        normalized: list[str] = []
        for raw in v:
            if raw is None:
                continue
            item = str(raw).strip().lower()
            if not item:
                continue
            if item.startswith("."):
                item = item[1:]
            normalized.append(item)
        return normalized

    @field_validator("allowlist_cidrs", mode="before")
    @classmethod
    def _normalize_allowlist_cidrs(cls, v: object) -> list[str]:
        if v is None or v == "":
            return []
        if not isinstance(v, list):
            raise TypeError("allowlist_cidrs must be a list of CIDR strings")
        normalized: list[str] = []
        for raw in v:
            if raw is None:
                continue
            item = str(raw).strip()
            if not item:
                continue
            try:
                ipaddress.ip_network(item, strict=False)
            except ValueError as exc:
                raise ValueError(f"invalid CIDR: {item}") from exc
            normalized.append(item)
        return normalized


class UrlFetchSettings(BaseModel):
    """URL 内容获取配置。"""
    proxy: HttpProxySettings = Field(default_factory=_default_factory(HttpProxySettings), description="代理配置")
    timeout: int = Field(30, ge=5, le=120, description="请求超时时间（秒）")
    retry_count: int = Field(2, ge=0, le=5, description="重试次数")
    retry_delay: float = Field(1.0, ge=0.0, le=10.0, description="重试间隔（秒）")
    security: UrlFetchSecuritySettings = Field(
        default_factory=_default_factory(UrlFetchSecuritySettings),
        description="URL fetch SSRF 安全策略（默认拒绝 localhost/私网/元数据等高风险目标）。",
    )


# =============================================================================
# Web Extraction Settings
# =============================================================================

class TrafilaturaSettings(BaseModel):
    """Trafilatura 本地提取器配置。"""
    enabled: bool = Field(True, description="是否启用 Trafilatura 提取器")
    include_tables: bool = Field(True, description="是否提取表格")
    include_links: bool = Field(True, description="是否提取链接")
    output_format: Literal["markdown", "txt", "xml", "json"] = Field(
        "markdown", description="输出格式"
    )
    timeout: int = Field(30, ge=5, le=120, description="请求超时时间（秒）")
    proxy: HttpProxySettings | None = Field(None, description="代理配置（可选）")


class JinaSettings(BaseModel):
    """Jina Reader API 提取器配置。"""
    enabled: bool = Field(True, description="是否启用 Jina Reader 提取器")
    api_key: str | None = Field(None, description="Jina API 密钥（可选，用于更高配额）")
    timeout: int = Field(30, ge=5, le=120, description="请求超时时间（秒）")
    proxy: HttpProxySettings | None = Field(None, description="代理配置（可选）")


class FirecrawlSettings(BaseModel):
    """Firecrawl API 提取器配置。"""
    enabled: bool = Field(False, description="是否启用 Firecrawl 提取器")
    api_key: str | None = Field(None, description="Firecrawl API 密钥")
    timeout: int = Field(60, ge=10, le=300, description="请求超时时间（秒）")


class BrowserlessSettings(BaseModel):
    """Browserless 浏览器渲染提取器配置。"""
    enabled: bool = Field(False, description="是否启用 Browserless 提取器")
    endpoint: str = Field("ws://localhost:3000", description="Browserless WebSocket 端点")
    token: str | None = Field(None, description="认证令牌（可选）")
    timeout: int = Field(60, ge=10, le=300, description="页面加载超时时间（秒）")
    wait_until: Literal["load", "domcontentloaded", "networkidle"] = Field(
        "networkidle", description="页面等待条件"
    )


class WebExtractionSettings(BaseModel):
    """
    网页内容提取配置。

    支持多种提取策略，按优先级自动降级：
    1. trafilatura - 本地提取，速度快，无需外部服务
    2. jina - Jina Reader API，免费且支持 JS 渲染
    3. firecrawl - 外部 API，功能强大，需要 API 密钥
    4. browserless - 浏览器渲染，适合复杂动态页面，需要服务

    Example:
        web_extraction:
          fallback_order: ["trafilatura", "jina", "firecrawl", "browserless"]
          trafilatura:
            enabled: true
            output_format: "markdown"
          jina:
            enabled: true
          firecrawl:
            enabled: false
            api_key: "fc-xxx"
          browserless:
            enabled: false
            endpoint: "ws://localhost:3000"
    """
    # 降级顺序配置
    fallback_order: list[str] = Field(
        default_factory=lambda: ["trafilatura", "jina", "firecrawl", "browserless"],
        description="提取器降级顺序（按优先级排列）",
    )
    enable_fallback: bool = Field(True, description="是否启用自动降级")

    # 各提取器配置
    trafilatura: TrafilaturaSettings = Field(
        default_factory=_default_factory(TrafilaturaSettings),
        description="Trafilatura 本地提取器配置",
    )
    jina: JinaSettings = Field(
        default_factory=_default_factory(JinaSettings),
        description="Jina Reader API 提取器配置",
    )
    firecrawl: FirecrawlSettings = Field(
        default_factory=_default_factory(FirecrawlSettings),
        description="Firecrawl API 提取器配置",
    )
    browserless: BrowserlessSettings = Field(
        default_factory=_default_factory(BrowserlessSettings),
        description="Browserless 浏览器渲染提取器配置",
    )


class SourceDedupSettings(BaseModel):
    """来源去重配置（可选）。"""

    enabled: bool = Field(False, description="是否启用来源去重（默认关闭）")


class SourceIngestionSettings(BaseModel):
    """来源导入配置。"""

    url_fetch: UrlFetchSettings = Field(default_factory=_default_factory(UrlFetchSettings), description="URL 获取配置")
    web_extraction: WebExtractionSettings = Field(
        default_factory=_default_factory(WebExtractionSettings),
        description="网页内容提取配置",
    )
    dedup: SourceDedupSettings = Field(
        default_factory=_default_factory(SourceDedupSettings),
        description="来源去重配置（upload/url），默认关闭。",
    )


# =============================================================================
# Main Settings Class
# =============================================================================

class Settings(BaseSettings):
    """
    Crystalith configuration settings.

    Supports YAML configuration with:
    - Version control (name, version, schema)
    - YAML anchors for reusable configurations
    - Environment variable interpolation: ${{ env.VAR }}
    - Secrets interpolation: ${{ secrets.VAR }}

    Example config/app.yaml:

        # yaml-language-server: $schema=./app.schema.json
        %YAML 1.1
        ---
        name: "My Crystalith Instance"
        version: "1.0.0"
        schema: v1

        # Reusable provider configs (use YAML anchors)
        providers:
          openai_main: &openai_main
            api_key: ${{ env.OPENAI_API_KEY }}
            base_url: "https://api.openai.com/v1"

          ollama_local: &ollama_local
            host: "http://localhost:11434"

        models:
          defaults:
            chat: "gpt-5.2"
            embedding: "bge-m3-local"
          available:
            - id: "gpt-5.2"
              provider: "openai"
              model: "gpt-5.2"
              display_name: "GPT-5.2"
              roles: [chat, edit]
              capabilities: [tool_use]
              provider_config:
                <<: *openai_main
              completion_options:
                temperature: 0.7
    """
    model_config = SettingsConfigDict(extra="ignore", env_prefix="CRYSTALITH_")

    # === Metadata (Continue-style) ===
    name: str = Field(default="Crystalith", description="Configuration name")
    version: str = Field(default="1.0.0", description="Configuration version")
    schema_version: str = Field(default="v1", alias="schema", description="Schema version")

    # === Providers (for YAML anchor references) ===
    providers: dict[str, JsonValue] = Field(
        default_factory=dict,
        description="Reusable provider configurations (use YAML anchors)",
    )

    # === Core Settings ===
    app: AppSettings = Field(default_factory=_default_factory(AppSettings))
    database: DatabaseSettings = Field(default_factory=_default_factory(DatabaseSettings))
    vector_storage: VectorStorageSettings = Field(default_factory=_default_factory(VectorStorageSettings))
    cache: CacheSettings = Field(default_factory=_default_factory(CacheSettings))

    # === Feature Settings ===
    embedding: EmbeddingSettings = Field(default_factory=_default_factory(EmbeddingSettings))
    ai: AISettings = Field(default_factory=_default_factory(AISettings))
    concurrency: ConcurrencySettings = Field(
        default_factory=_default_factory(ConcurrencySettings),
        description="Concurrency guardrails",
    )
    chat: ChatSettings = Field(default_factory=_default_factory(ChatSettings))
    refine: RefineSettings = Field(default_factory=_default_factory(RefineSettings))
    context_window: ContextWindowSettings = Field(default_factory=_default_factory(ContextWindowSettings))
    search: SearchSettings = Field(default_factory=_default_factory(SearchSettings), description="Web search settings")
    optional_services: OptionalServicesSettings = Field(
        default_factory=_default_factory(OptionalServicesSettings),
        description="Optional dependency service contracts and probe policies",
    )
    plugins: PluginsSettings = Field(default_factory=_default_factory(PluginsSettings), description="插件加载配置")
    source_ingestion: SourceIngestionSettings = Field(
        default_factory=_default_factory(SourceIngestionSettings),
        description="来源导入配置（包含 URL 获取和代理设置）",
    )

    # === Models ===
    models: ModelsSettings = Field(default_factory=_default_factory(ModelsSettings), description="Model configurations")

    @classmethod
    def settings_customise_sources(
        cls,
        settings_cls: type[BaseSettings],
        init_settings,
        env_settings,
        dotenv_settings,
        file_secret_settings,
    ):
        return (init_settings,)

    @classmethod
    def from_yaml(
        cls,
        path: Path,
        secrets: dict[str, str] | None = None,
    ) -> Settings:
        """
        Load settings from a YAML file with variable resolution.

        Args:
            path: Path to the YAML config file
            secrets: Optional dict of secrets for ${{ secrets.VAR }} resolution

        Returns:
            Validated Settings instance
        """
        if not path.is_file():
            raise FileNotFoundError(f"Config file not found: {path}")

        source = YamlConfigSettingsSource(cls, yaml_file=path, yaml_file_encoding="utf-8")
        data = source()

        # Resolve environment variables and secrets
        data = resolve_variables(data, secrets)

        return cls.model_validate(data)

    def get_model_config(self, model_id: str) -> ModelConfig | None:
        """Get a model configuration by ID."""
        return self.models.get_model(model_id)

    def get_default_chat_model(self) -> ModelConfig | None:
        """Get the default chat model."""
        return self.models.get_default_for_role("chat")

    def get_default_embedding_model(self) -> ModelConfig | None:
        """Get the default embedding model."""
        return self.models.get_default_for_role("embed")

    def get_openai_settings_for_model(self, model_config: ModelConfig) -> OpenAIProviderSettings:
        """
        Get OpenAI settings for a model.

        Settings are taken from the model's provider_config.
        """
        return model_config.get_openai_config()

    def get_ollama_settings_for_model(self, model_config: ModelConfig) -> OllamaProviderSettings:
        """
        Get Ollama settings for a model.

        Settings are taken from the model's provider_config.
        """
        return model_config.get_ollama_config()
