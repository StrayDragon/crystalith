from __future__ import annotations

from collections.abc import Mapping
from typing import TYPE_CHECKING, Any, TypeVar

from attrs import define as _attrs_define
from attrs import field as _attrs_field

if TYPE_CHECKING:
    from ..models.slide_generation_config import SlideGenerationConfig
    from ..models.slides_config_option import SlidesConfigOption
    from ..models.slides_theme_preset import SlidesThemePreset


T = TypeVar("T", bound="SlidesConfigResponse")


@_attrs_define
class SlidesConfigResponse:
    """
    Attributes:
        defaults (SlideGenerationConfig):
        quantity_options (list[SlidesConfigOption]):
        audience_options (list[SlidesConfigOption]):
        structure_options (list[SlidesConfigOption]):
        tone_options (list[SlidesConfigOption]):
        language_options (list[SlidesConfigOption]):
        density_options (list[SlidesConfigOption]):
        theme_preset_options (list[SlidesThemePreset]):
    """

    defaults: SlideGenerationConfig
    quantity_options: list[SlidesConfigOption]
    audience_options: list[SlidesConfigOption]
    structure_options: list[SlidesConfigOption]
    tone_options: list[SlidesConfigOption]
    language_options: list[SlidesConfigOption]
    density_options: list[SlidesConfigOption]
    theme_preset_options: list[SlidesThemePreset]
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)

    def to_dict(self) -> dict[str, Any]:
        defaults = self.defaults.to_dict()

        quantity_options = []
        for quantity_options_item_data in self.quantity_options:
            quantity_options_item = quantity_options_item_data.to_dict()
            quantity_options.append(quantity_options_item)

        audience_options = []
        for audience_options_item_data in self.audience_options:
            audience_options_item = audience_options_item_data.to_dict()
            audience_options.append(audience_options_item)

        structure_options = []
        for structure_options_item_data in self.structure_options:
            structure_options_item = structure_options_item_data.to_dict()
            structure_options.append(structure_options_item)

        tone_options = []
        for tone_options_item_data in self.tone_options:
            tone_options_item = tone_options_item_data.to_dict()
            tone_options.append(tone_options_item)

        language_options = []
        for language_options_item_data in self.language_options:
            language_options_item = language_options_item_data.to_dict()
            language_options.append(language_options_item)

        density_options = []
        for density_options_item_data in self.density_options:
            density_options_item = density_options_item_data.to_dict()
            density_options.append(density_options_item)

        theme_preset_options = []
        for theme_preset_options_item_data in self.theme_preset_options:
            theme_preset_options_item = theme_preset_options_item_data.to_dict()
            theme_preset_options.append(theme_preset_options_item)

        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update(
            {
                "defaults": defaults,
                "quantity_options": quantity_options,
                "audience_options": audience_options,
                "structure_options": structure_options,
                "tone_options": tone_options,
                "language_options": language_options,
                "density_options": density_options,
                "theme_preset_options": theme_preset_options,
            }
        )

        return field_dict

    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.slide_generation_config import SlideGenerationConfig
        from ..models.slides_config_option import SlidesConfigOption
        from ..models.slides_theme_preset import SlidesThemePreset

        d = dict(src_dict)
        defaults = SlideGenerationConfig.from_dict(d.pop("defaults"))

        quantity_options = []
        _quantity_options = d.pop("quantity_options")
        for quantity_options_item_data in _quantity_options:
            quantity_options_item = SlidesConfigOption.from_dict(quantity_options_item_data)

            quantity_options.append(quantity_options_item)

        audience_options = []
        _audience_options = d.pop("audience_options")
        for audience_options_item_data in _audience_options:
            audience_options_item = SlidesConfigOption.from_dict(audience_options_item_data)

            audience_options.append(audience_options_item)

        structure_options = []
        _structure_options = d.pop("structure_options")
        for structure_options_item_data in _structure_options:
            structure_options_item = SlidesConfigOption.from_dict(structure_options_item_data)

            structure_options.append(structure_options_item)

        tone_options = []
        _tone_options = d.pop("tone_options")
        for tone_options_item_data in _tone_options:
            tone_options_item = SlidesConfigOption.from_dict(tone_options_item_data)

            tone_options.append(tone_options_item)

        language_options = []
        _language_options = d.pop("language_options")
        for language_options_item_data in _language_options:
            language_options_item = SlidesConfigOption.from_dict(language_options_item_data)

            language_options.append(language_options_item)

        density_options = []
        _density_options = d.pop("density_options")
        for density_options_item_data in _density_options:
            density_options_item = SlidesConfigOption.from_dict(density_options_item_data)

            density_options.append(density_options_item)

        theme_preset_options = []
        _theme_preset_options = d.pop("theme_preset_options")
        for theme_preset_options_item_data in _theme_preset_options:
            theme_preset_options_item = SlidesThemePreset.from_dict(theme_preset_options_item_data)

            theme_preset_options.append(theme_preset_options_item)

        slides_config_response = cls(
            defaults=defaults,
            quantity_options=quantity_options,
            audience_options=audience_options,
            structure_options=structure_options,
            tone_options=tone_options,
            language_options=language_options,
            density_options=density_options,
            theme_preset_options=theme_preset_options,
        )

        slides_config_response.additional_properties = d
        return slides_config_response

    @property
    def additional_keys(self) -> list[str]:
        return list(self.additional_properties.keys())

    def __getitem__(self, key: str) -> Any:
        return self.additional_properties[key]

    def __setitem__(self, key: str, value: Any) -> None:
        self.additional_properties[key] = value

    def __delitem__(self, key: str) -> None:
        del self.additional_properties[key]

    def __contains__(self, key: str) -> bool:
        return key in self.additional_properties
