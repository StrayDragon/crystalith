from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, cast

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

T = TypeVar("T", bound="SlideGenerationConfig")


@_attrs_define
class SlideGenerationConfig:
    """
    Attributes:
        quantity (None | str | Unset):
        audience (None | str | Unset):
        structure (None | str | Unset):
        tone (None | str | Unset):
        language (None | str | Unset):
        density (None | str | Unset):
        theme_preset (None | str | Unset):
        frontmatter (None | str | Unset):
    """

    quantity: None | str | Unset = UNSET
    audience: None | str | Unset = UNSET
    structure: None | str | Unset = UNSET
    tone: None | str | Unset = UNSET
    language: None | str | Unset = UNSET
    density: None | str | Unset = UNSET
    theme_preset: None | str | Unset = UNSET
    frontmatter: None | str | Unset = UNSET
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)

    def to_dict(self) -> dict[str, Any]:
        quantity: None | str | Unset
        if isinstance(self.quantity, Unset):
            quantity = UNSET
        else:
            quantity = self.quantity

        audience: None | str | Unset
        if isinstance(self.audience, Unset):
            audience = UNSET
        else:
            audience = self.audience

        structure: None | str | Unset
        if isinstance(self.structure, Unset):
            structure = UNSET
        else:
            structure = self.structure

        tone: None | str | Unset
        if isinstance(self.tone, Unset):
            tone = UNSET
        else:
            tone = self.tone

        language: None | str | Unset
        if isinstance(self.language, Unset):
            language = UNSET
        else:
            language = self.language

        density: None | str | Unset
        if isinstance(self.density, Unset):
            density = UNSET
        else:
            density = self.density

        theme_preset: None | str | Unset
        if isinstance(self.theme_preset, Unset):
            theme_preset = UNSET
        else:
            theme_preset = self.theme_preset

        frontmatter: None | str | Unset
        if isinstance(self.frontmatter, Unset):
            frontmatter = UNSET
        else:
            frontmatter = self.frontmatter

        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({})
        if quantity is not UNSET:
            field_dict["quantity"] = quantity
        if audience is not UNSET:
            field_dict["audience"] = audience
        if structure is not UNSET:
            field_dict["structure"] = structure
        if tone is not UNSET:
            field_dict["tone"] = tone
        if language is not UNSET:
            field_dict["language"] = language
        if density is not UNSET:
            field_dict["density"] = density
        if theme_preset is not UNSET:
            field_dict["theme_preset"] = theme_preset
        if frontmatter is not UNSET:
            field_dict["frontmatter"] = frontmatter

        return field_dict

    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)

        def _parse_quantity(data: object) -> None | str | Unset:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            return cast(None | str | Unset, data)

        quantity = _parse_quantity(d.pop("quantity", UNSET))

        def _parse_audience(data: object) -> None | str | Unset:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            return cast(None | str | Unset, data)

        audience = _parse_audience(d.pop("audience", UNSET))

        def _parse_structure(data: object) -> None | str | Unset:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            return cast(None | str | Unset, data)

        structure = _parse_structure(d.pop("structure", UNSET))

        def _parse_tone(data: object) -> None | str | Unset:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            return cast(None | str | Unset, data)

        tone = _parse_tone(d.pop("tone", UNSET))

        def _parse_language(data: object) -> None | str | Unset:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            return cast(None | str | Unset, data)

        language = _parse_language(d.pop("language", UNSET))

        def _parse_density(data: object) -> None | str | Unset:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            return cast(None | str | Unset, data)

        density = _parse_density(d.pop("density", UNSET))

        def _parse_theme_preset(data: object) -> None | str | Unset:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            return cast(None | str | Unset, data)

        theme_preset = _parse_theme_preset(d.pop("theme_preset", UNSET))

        def _parse_frontmatter(data: object) -> None | str | Unset:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            return cast(None | str | Unset, data)

        frontmatter = _parse_frontmatter(d.pop("frontmatter", UNSET))

        slide_generation_config = cls(
            quantity=quantity,
            audience=audience,
            structure=structure,
            tone=tone,
            language=language,
            density=density,
            theme_preset=theme_preset,
            frontmatter=frontmatter,
        )

        slide_generation_config.additional_properties = d
        return slide_generation_config

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
