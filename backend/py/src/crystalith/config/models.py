from __future__ import annotations

from pathlib import Path
from typing import Any, Literal

import yaml
from pydantic import BaseModel, Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class AppSettings(BaseModel):
    name: str = "Crystalith"
    openapi_path: str = "/v1/codev/openapi.json"
    openapi_ui_path: str = "/v1/codev/openapi-ui/scaler"


class DatabaseSettings(BaseModel):
    url: str = "sqlite+aiosqlite:///./data/app.db"


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


class Settings(BaseSettings):
    model_config = SettingsConfigDict(extra="ignore", env_prefix="CRYSTALITH_")

    app: AppSettings = Field(default_factory=AppSettings)
    database: DatabaseSettings = Field(default_factory=DatabaseSettings)
    openai: OpenAIProviderSettings = Field(default_factory=OpenAIProviderSettings)
    ollama: OllamaProviderSettings = Field(default_factory=OllamaProviderSettings)
    embedding: EmbeddingSettings = Field(default_factory=EmbeddingSettings)
    chat: ChatSettings = Field(default_factory=ChatSettings)
    refine: RefineSettings = Field(default_factory=RefineSettings)

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
        data = yaml.safe_load(path.read_text(encoding="utf-8")) or {}
        return cls.model_validate(data)
