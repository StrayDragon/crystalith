from __future__ import annotations

from pathlib import Path
from typing import Any, Literal

from pydantic import BaseModel, Field
from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic_settings.sources import YamlConfigSettingsSource


class AppSettings(BaseModel):
    name: str = "Crystalith"
    openapi_path: str = "/v1/codev/openapi.json"
    openapi_ui_path: str = "/v1/codev/openapi-ui/scalar"


class DatabaseSettings(BaseModel):
    url: str = "sqlite+aiosqlite:///./data/app.db"


class VectorStorageSQLiteSettings(BaseModel):
    path: str = "./data/vectors.db"


class VectorStorageChromaSettings(BaseModel):
    host: str = "localhost"
    port: int = 8000


class VectorStorageSettings(BaseModel):
    provider: Literal["memory", "sqlite", "chroma"] = "memory"
    sqlite: VectorStorageSQLiteSettings = Field(default_factory=VectorStorageSQLiteSettings)
    chroma: VectorStorageChromaSettings = Field(default_factory=VectorStorageChromaSettings)


class OpenAIProviderSettings(BaseModel):
    api_key: str | None = None
    base_url: str | None = None
    organization: str | None = None
    project: str | None = None


class OllamaProviderSettings(BaseModel):
    host: str = "http://localhost:11434"


class OllamaRuntimeOptions(BaseModel):
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


class EmbeddingSettings(BaseModel):
    provider: Literal["ollama", "openai"] = "ollama"
    model: str = "bge-m3"
    openai: OpenAIProviderSettings | None = None
    ollama_options: OllamaRuntimeOptions = Field(default_factory=OllamaRuntimeOptions)


class ChatSettings(BaseModel):
    provider: Literal["openai", "ollama"] = "openai"
    model: str = "gpt-4o-mini"
    openai: OpenAIProviderSettings | None = None


class RefineSettings(BaseModel):
    formats: list[str] = Field(default_factory=lambda: ["paragraph", "bullets", "structured"])


class ContextWindowSettings(BaseModel):
    max_tokens: int = Field(8000, ge=1)
    compression_strategy: Literal["truncate", "summarize"] = "truncate"
    window_size: int = Field(10, ge=0)
    priority: list[Literal["history", "retrieval", "recent", "system"]] = Field(
        default_factory=lambda: ["history", "retrieval", "recent", "system"]
    )


class ModelConfig(BaseModel):
    """Configuration for a single AI model."""

    id: str = Field(..., description="Unique identifier for the model")
    provider: Literal["openai", "ollama"] = Field(..., description="Provider type")
    model: str = Field(..., description="Model name/identifier used by the provider")
    display_name: str = Field(..., description="Human-readable display name")
    description: str = Field("", description="Optional description of the model")
    capabilities: list[Literal["chat", "embedding"]] = Field(
        default_factory=lambda: ["chat"],
        description="List of capabilities this model supports",
    )


class ModelsSettings(BaseModel):
    """Settings for multi-model configuration."""

    available: list[ModelConfig] = Field(
        default_factory=list,
        description="List of available AI models",
    )
    default_chat: str | None = Field(
        None,
        description="Default model ID for chat/generation tasks",
    )
    default_embedding: str | None = Field(
        None,
        description="Default model ID for embedding tasks",
    )


class Settings(BaseSettings):
    model_config = SettingsConfigDict(extra="ignore", env_prefix="CRYSTALITH_")

    app: AppSettings = Field(default_factory=AppSettings)
    database: DatabaseSettings = Field(default_factory=DatabaseSettings)
    vector_storage: VectorStorageSettings = Field(default_factory=VectorStorageSettings)
    openai: OpenAIProviderSettings = Field(default_factory=OpenAIProviderSettings)
    ollama: OllamaProviderSettings = Field(default_factory=OllamaProviderSettings)
    embedding: EmbeddingSettings = Field(default_factory=EmbeddingSettings)
    chat: ChatSettings = Field(default_factory=ChatSettings)
    refine: RefineSettings = Field(default_factory=RefineSettings)
    context_window: ContextWindowSettings = Field(default_factory=ContextWindowSettings)
    models: ModelsSettings = Field(default_factory=ModelsSettings)

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
    def from_yaml(cls, path: Path) -> "Settings":
        if not path.is_file():
            raise FileNotFoundError(f"Config file not found: {path}")
        source = YamlConfigSettingsSource(cls, yaml_file=path, yaml_file_encoding="utf-8")
        data = source()
        return cls.model_validate(data)
