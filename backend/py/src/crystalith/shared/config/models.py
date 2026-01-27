from __future__ import annotations

import os
import re
from pathlib import Path
from typing import Any, Literal

from pydantic import BaseModel, Field, field_validator, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic_settings.sources import YamlConfigSettingsSource


# =============================================================================
# Secrets / Environment Variable Resolution
# =============================================================================

_VAR_PATTERN = re.compile(r"\$\{\{\s*(env|secrets)\.(\w+)\s*\}\}")


def resolve_variables(value: Any, secrets: dict[str, str] | None = None) -> Any:
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
    elif isinstance(value, dict):
        return {k: resolve_variables(v, secrets) for k, v in value.items()}
    elif isinstance(value, list):
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

    def to_options(self) -> dict[str, Any] | None:
        data = self.model_dump(exclude_none=True)
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
    provider: Literal["openai", "ollama"] = Field(..., description="Provider type")
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
    provider_config: OpenAIProviderSettings | OllamaProviderSettings | dict[str, Any] | None = Field(
        None,
        description="Provider-specific configuration (can reference providers via anchors)",
    )

    # Completion options
    completion_options: CompletionOptions | None = Field(
        None,
        description="Default completion options for this model",
    )

    # Ollama-specific options
    ollama_options: OllamaRuntimeOptions | None = Field(
        None,
        description="Ollama-specific runtime options",
    )

    # Request options
    request_options: RequestOptions | None = Field(
        None,
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
            return OpenAIProviderSettings(**self.provider_config)
        return OpenAIProviderSettings()

    def get_ollama_config(self) -> OllamaProviderSettings:
        """Extract Ollama provider config."""
        if isinstance(self.provider_config, OllamaProviderSettings):
            return self.provider_config
        elif isinstance(self.provider_config, dict):
            return OllamaProviderSettings(**self.provider_config)
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
    defaults: ModelDefaults = Field(default_factory=ModelDefaults)
    available: list[ModelConfig] = Field(default_factory=list)

    @model_validator(mode="after")
    def validate_defaults(self) -> "ModelsSettings":
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
        default_id = getattr(self.defaults, role, None)
        if default_id:
            return self.get_model(default_id)
        # Fallback to first model with this role
        models = self.get_models_by_role(role)
        return models[0] if models else None


# =============================================================================
# Feature Settings
# =============================================================================

class AppSettings(BaseModel):
    """Application settings."""
    name: str = "Crystalith"
    openapi_path: str = "/v1/codev/openapi.json"
    openapi_ui_path: str = "/v1/codev/openapi-ui/scalar"


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
    sqlite: VectorStorageSQLiteSettings = Field(default_factory=VectorStorageSQLiteSettings)
    chroma: VectorStorageChromaSettings = Field(default_factory=VectorStorageChromaSettings)


class EmbeddingSettings(BaseModel):
    """
    Embedding settings.

    Use models.defaults.embedding to specify the default embedding model.
    This section only contains embedding-specific options.
    """
    chunk_size: int = Field(512, ge=64, description="Default chunk size for embedding")
    batch_size: int = Field(32, ge=1, description="Batch size for embedding requests")


class ChatSettings(BaseModel):
    """
    Chat settings.

    Use models.defaults.chat to specify the default chat model.
    This section only contains chat-specific options.
    """
    # Future: add chat-specific options like system prompt template, etc.
    pass


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
    host: str = Field("http://localhost:8888", description="SearXNG instance URL")
    api_key: str | None = Field(None, description="Optional API key for authentication")
    timeout: int = Field(10, ge=1, description="Request timeout in seconds")
    max_results: int = Field(10, ge=1, le=50, description="Maximum number of results")


class SearchSettings(BaseModel):
    """Web search settings."""
    searxng: SearXNGSettings = Field(default_factory=lambda: SearXNGSettings())


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


class UrlFetchSettings(BaseModel):
    """URL 内容获取配置。"""
    proxy: HttpProxySettings = Field(default_factory=HttpProxySettings, description="代理配置")
    timeout: int = Field(30, ge=5, le=120, description="请求超时时间（秒）")
    retry_count: int = Field(2, ge=0, le=5, description="重试次数")
    retry_delay: float = Field(1.0, ge=0.0, le=10.0, description="重试间隔（秒）")


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
        default_factory=TrafilaturaSettings,
        description="Trafilatura 本地提取器配置",
    )
    jina: JinaSettings = Field(
        default_factory=JinaSettings,
        description="Jina Reader API 提取器配置",
    )
    firecrawl: FirecrawlSettings = Field(
        default_factory=FirecrawlSettings,
        description="Firecrawl API 提取器配置",
    )
    browserless: BrowserlessSettings = Field(
        default_factory=BrowserlessSettings,
        description="Browserless 浏览器渲染提取器配置",
    )


class SourceIngestionSettings(BaseModel):
    """来源导入配置。"""
    url_fetch: UrlFetchSettings = Field(default_factory=UrlFetchSettings, description="URL 获取配置")
    web_extraction: WebExtractionSettings = Field(
        default_factory=WebExtractionSettings,
        description="网页内容提取配置",
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

        # yaml-language-server: $schema=./schema.json
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
    name: str = Field("Crystalith", description="Configuration name")
    version: str = Field("1.0.0", description="Configuration version")
    schema_version: str = Field("v1", alias="schema", description="Schema version")

    # === Providers (for YAML anchor references) ===
    providers: dict[str, Any] = Field(
        default_factory=dict,
        description="Reusable provider configurations (use YAML anchors)",
    )

    # === Core Settings ===
    app: AppSettings = Field(default_factory=AppSettings)
    database: DatabaseSettings = Field(default_factory=DatabaseSettings)
    vector_storage: VectorStorageSettings = Field(default_factory=VectorStorageSettings)

    # === Feature Settings ===
    embedding: EmbeddingSettings = Field(default_factory=EmbeddingSettings)
    chat: ChatSettings = Field(default_factory=ChatSettings)
    refine: RefineSettings = Field(default_factory=RefineSettings)
    context_window: ContextWindowSettings = Field(default_factory=ContextWindowSettings)
    search: SearchSettings = Field(default_factory=lambda: SearchSettings(), description="Web search settings")
    source_ingestion: SourceIngestionSettings = Field(
        default_factory=SourceIngestionSettings,
        description="来源导入配置（包含 URL 获取和代理设置）",
    )

    # === Models ===
    models: ModelsSettings = Field(default_factory=ModelsSettings, description="Model configurations")

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
    ) -> "Settings":
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
