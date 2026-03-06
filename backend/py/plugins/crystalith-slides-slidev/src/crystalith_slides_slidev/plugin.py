from __future__ import annotations

from crystalith.shared.plugins.render_types import (
    ConfigOption,
    FrontendBundleDescriptor,
    OutputTypePluginMeta,
    PluginConfigSchema,
    PreviewDescriptor,
    ThemePresetOption,
)

from .config import (
    AUDIENCE_OPTIONS,
    DEFAULT_CONFIG,
    DENSITY_OPTIONS,
    LANGUAGE_OPTIONS,
    QUANTITY_OPTIONS,
    STRUCTURE_OPTIONS,
    THEME_PRESET_OPTIONS,
    TONE_OPTIONS,
    SlidesOption,
    SlidesThemePreset,
)
from .generator import generate_slides_markdown, generate_slides_outline


def _to_option(option: SlidesOption) -> ConfigOption:
    return ConfigOption(
        id=option.id,
        label=option.label,
        is_default=option.is_default,
    )


def _to_theme(option: SlidesThemePreset) -> ThemePresetOption:
    return ThemePresetOption(
        id=option.id,
        label=option.label,
        template=dict(option.template),
    )


class SlidevSlidesWorkflowPlugin:
    api_version = "v1"

    engine = "slidev"
    default_prompt = "生成一份逻辑清晰、适合演示的 Slides。"
    metadata = OutputTypePluginMeta(
        description="演示文稿",
        display_text="演示",
        tone="indigo",
    )
    preview_descriptor = PreviewDescriptor(
        kind="external_url",
        service="slidev",
        meta={"package": "@crystalith-slidev"},
    )
    frontend_bundle = FrontendBundleDescriptor(
        id="output-slides",
        export="render",
        meta={"engine": "slidev", "preview_service": "slidev"},
    )
    config_schema = PluginConfigSchema(
        defaults=DEFAULT_CONFIG.model_dump(exclude_none=True),
        quantity_options=[_to_option(option) for option in QUANTITY_OPTIONS],
        audience_options=[_to_option(option) for option in AUDIENCE_OPTIONS],
        structure_options=[_to_option(option) for option in STRUCTURE_OPTIONS],
        tone_options=[_to_option(option) for option in TONE_OPTIONS],
        language_options=[_to_option(option) for option in LANGUAGE_OPTIONS],
        density_options=[_to_option(option) for option in DENSITY_OPTIONS],
        theme_preset_options=[_to_theme(option) for option in THEME_PRESET_OPTIONS],
        engine="slidev",
        preview=PreviewDescriptor(
            kind="external_url",
            service="slidev",
            meta={"package": "@crystalith-slidev"},
        ),
    )

    async def generate_outline(self, *args, **kwargs):  # noqa: ANN002, ANN003
        return await generate_slides_outline(*args, **kwargs)

    async def generate_markdown(self, *args, **kwargs):  # noqa: ANN002, ANN003
        return await generate_slides_markdown(*args, **kwargs)


plugin = SlidevSlidesWorkflowPlugin()
