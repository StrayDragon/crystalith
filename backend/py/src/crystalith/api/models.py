"""API endpoints for model management.

This module provides REST API endpoints for listing and retrieving
available AI models configured in the application.
"""

from __future__ import annotations

from typing import Literal

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from crystalith.config import ModelConfig, Settings

from .deps import get_settings


router = APIRouter(prefix="/v1/models", tags=["models"])


class ModelRead(BaseModel):
    """Response model for a single AI model."""

    id: str
    provider: Literal["openai", "ollama"]
    model: str
    display_name: str
    description: str
    capabilities: list[Literal["chat", "embedding"]]


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
        capabilities=config.capabilities,
    )


@router.get("", response_model=ModelsListResponse)
async def list_models(
    settings: Settings = Depends(get_settings),
    capability: Literal["chat", "embedding"] | None = None,
) -> ModelsListResponse:
    """
    List all available AI models.

    Optionally filter by capability (chat or embedding).
    """
    models_settings = settings.models
    available = models_settings.available

    # Filter by capability if specified
    if capability:
        available = [m for m in available if capability in m.capabilities]

    return ModelsListResponse(
        models=[_model_config_to_read(m) for m in available],
        default_chat=models_settings.default_chat,
        default_embedding=models_settings.default_embedding,
    )


@router.get("/{model_id}", response_model=ModelRead)
async def get_model(
    model_id: str,
    settings: Settings = Depends(get_settings),
) -> ModelRead:
    """Get a specific model by ID."""
    for model in settings.models.available:
        if model.id == model_id:
            return _model_config_to_read(model)

    raise HTTPException(status_code=404, detail=f"Model not found: {model_id}")
