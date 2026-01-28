"""API endpoints for model management.

This module provides REST API endpoints for listing and retrieving
available AI models configured in the application.
"""

from __future__ import annotations

from typing import Literal

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from crystalith.shared.config import ModelConfig, ModelRole, Settings

from crystalith.shared.deps import get_settings


router = APIRouter(prefix="/v1/models", tags=["models"])


class ModelRead(BaseModel):
    """Response model for a single AI model."""

    id: str
    provider: Literal["openai", "ollama"]
    model: str
    display_name: str
    description: str
    roles: list[str] = Field(default_factory=list, description="Model roles: chat, embed, edit, etc.")
    capabilities: list[str] = Field(default_factory=list, description="Special capabilities: tool_use, image_input, etc.")


class ModelsListResponse(BaseModel):
    """Response model for the models list endpoint."""

    models: list[ModelRead]
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
    role: Literal["chat", "embed", "edit", "autocomplete"] | None = None,
    capability: str | None = None,
) -> ModelsListResponse:
    """
    List all available AI models.

    Optionally filter by role (chat, embed, edit, autocomplete) or capability.
    """
    models_settings = settings.models
    available = models_settings.available

    # Filter by role if specified
    if role:
        available = [m for m in available if m.has_role(role)]

    # Filter by capability if specified (supports legacy 'chat'/'embedding')
    if capability:
        available = [m for m in available if m.has_capability(capability)]

    return ModelsListResponse(
        models=[_model_config_to_read(m) for m in available],
        default_chat=models_settings.defaults.chat,
        default_embedding=models_settings.defaults.embedding,
    )


@router.get("/{model_id}", response_model=ModelRead)
async def get_model(
    model_id: str,
    settings: Settings = Depends(get_settings),
) -> ModelRead:
    """Get a specific model by ID."""
    model = settings.get_model_config(model_id)
    if model:
        return _model_config_to_read(model)

    raise HTTPException(status_code=404, detail=f"Model not found: {model_id}")
