"""API endpoints for model management.

This module provides REST API endpoints for listing and retrieving
available AI models configured in the application.
"""

from __future__ import annotations

from typing import Literal

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from crystalith.shared.config import ModelConfig, Settings, auto_discover_ollama

from crystalith.shared.deps import get_settings
from crystalith.shared.deps import get_plugin_registry
from crystalith.shared.plugins import PluginRegistry

import logging

_logger = logging.getLogger(__name__)


router = APIRouter(prefix="/v1/models", tags=["models"])


class ModelRead(BaseModel):
    """Response model for a single AI model."""

    id: str
    provider: str
    model: str
    display_name: str
    description: str
    roles: list[str] = Field(default_factory=list, description="Model roles: chat, embed, edit, etc.")
    capabilities: list[str] = Field(default_factory=list, description="Special capabilities: tool_use, image_input, etc.")


class ModelsListResponse(BaseModel):
    """Response model for the models list endpoint."""

    models: list[ModelRead]
    providers: list[str] = Field(default_factory=list, description="Available provider ids (built-in + plugins)")
    default_chat: str | None = None
    default_embedding: str | None = None


def _model_config_to_read(config: ModelConfig) -> ModelRead:
    """Convert ModelConfig to ModelRead."""
    return ModelRead(
        id=config.id,
        provider=config.provider,
        model=config.model,
        display_name=config.display_name,
        description=config.description,
        roles=list(config.roles),
        capabilities=list(config.capabilities),
    )


@router.get("", response_model=ModelsListResponse)
async def list_models(
    settings: Settings = Depends(get_settings),
    plugins: PluginRegistry = Depends(get_plugin_registry),
    role: Literal["chat", "embed", "edit", "autocomplete"] | None = None,
    capability: str | None = None,
    refresh: bool = False,
) -> ModelsListResponse:
    """
    List all available AI models.

    Optionally filter by role (chat, embed, edit, autocomplete) or capability.
    Set refresh=true to re-discover Ollama models.
    """
    # Optionally refresh Ollama model discovery
    if refresh:
        try:
            added = auto_discover_ollama(settings)
            if added:
                _logger.info("Refreshed: discovered %d new Ollama models", added)
        except Exception:
            _logger.debug("Ollama refresh failed", exc_info=True)

    models_settings = settings.models
    available = models_settings.available

    # Filter by role if specified
    if role:
        available = [m for m in available if m.has_role(role)]

    # Filter by capability if specified (supports legacy 'chat'/'embedding')
    if capability:
        available = [m for m in available if m.has_capability(capability)]

    # Filter out models whose provider is disabled/missing.
    available = [m for m in available if plugins.is_provider_available(m.provider)]

    resolved_default_chat = settings.get_default_chat_model()
    if resolved_default_chat and not plugins.is_provider_available(resolved_default_chat.provider):
        resolved_default_chat = None

    resolved_default_embedding = settings.get_default_embedding_model()
    if resolved_default_embedding and not plugins.is_provider_available(resolved_default_embedding.provider):
        resolved_default_embedding = None

    return ModelsListResponse(
        models=[_model_config_to_read(m) for m in available],
        providers=sorted({"openai", "ollama", *plugins.list_ai_providers()}),
        default_chat=resolved_default_chat.id if resolved_default_chat else None,
        default_embedding=resolved_default_embedding.id if resolved_default_embedding else None,
    )


@router.get("/{model_id}", response_model=ModelRead)
async def get_model(
    model_id: str,
    settings: Settings = Depends(get_settings),
    plugins: PluginRegistry = Depends(get_plugin_registry),
) -> ModelRead:
    """Get a specific model by ID."""
    model = settings.get_model_config(model_id)
    if model and plugins.is_provider_available(model.provider):
        return _model_config_to_read(model)

    raise HTTPException(status_code=404, detail=f"Model not found: {model_id}")
