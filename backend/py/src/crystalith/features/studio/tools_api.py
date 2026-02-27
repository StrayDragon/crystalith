from __future__ import annotations

from typing import Protocol

from fastapi import APIRouter
from pydantic import BaseModel

from crystalith.shared.json_types import JsonDict

from .slides.config import (
    AUDIENCE_OPTIONS,
    DEFAULT_CONFIG,
    DENSITY_OPTIONS,
    LANGUAGE_OPTIONS,
    QUANTITY_OPTIONS,
    STRUCTURE_OPTIONS,
    THEME_PRESET_OPTIONS,
    TONE_OPTIONS,
)
from .slides.schemas import SlideGenerationConfig


router = APIRouter(prefix="/v1/workspace/tools", tags=["workspace-tools"])


class SlidesConfigOption(BaseModel):
    id: str
    label: str
    is_default: bool = False


class SlidesThemePreset(BaseModel):
    id: str
    label: str
    template: JsonDict


class SlidesConfigResponse(BaseModel):
    defaults: SlideGenerationConfig
    quantity_options: list[SlidesConfigOption]
    audience_options: list[SlidesConfigOption]
    structure_options: list[SlidesConfigOption]
    tone_options: list[SlidesConfigOption]
    language_options: list[SlidesConfigOption]
    density_options: list[SlidesConfigOption]
    theme_preset_options: list[SlidesThemePreset]


class _OptionLike(Protocol):
    @property
    def id(self) -> str:
        ...

    @property
    def label(self) -> str:
        ...

    @property
    def is_default(self) -> bool:
        ...


class _ThemeLike(Protocol):
    @property
    def id(self) -> str:
        ...

    @property
    def label(self) -> str:
        ...

    @property
    def template(self) -> JsonDict:
        ...


def _option_to_response(option: _OptionLike) -> SlidesConfigOption:
    return SlidesConfigOption(id=option.id, label=option.label, is_default=option.is_default)


def _theme_to_response(option: _ThemeLike) -> SlidesThemePreset:
    return SlidesThemePreset(id=option.id, label=option.label, template=option.template)


@router.get("/slides/config", response_model=SlidesConfigResponse)
async def get_slides_config() -> SlidesConfigResponse:
    return SlidesConfigResponse(
        defaults=DEFAULT_CONFIG,
        quantity_options=[_option_to_response(option) for option in QUANTITY_OPTIONS],
        audience_options=[_option_to_response(option) for option in AUDIENCE_OPTIONS],
        structure_options=[_option_to_response(option) for option in STRUCTURE_OPTIONS],
        tone_options=[_option_to_response(option) for option in TONE_OPTIONS],
        language_options=[_option_to_response(option) for option in LANGUAGE_OPTIONS],
        density_options=[_option_to_response(option) for option in DENSITY_OPTIONS],
        theme_preset_options=[_theme_to_response(option) for option in THEME_PRESET_OPTIONS],
    )
