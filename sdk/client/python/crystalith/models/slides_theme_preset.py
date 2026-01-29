from __future__ import annotations

from collections.abc import Mapping
from typing import TYPE_CHECKING, Any, TypeVar

from attrs import define as _attrs_define
from attrs import field as _attrs_field

if TYPE_CHECKING:
    from ..models.slides_theme_preset_template import SlidesThemePresetTemplate


T = TypeVar("T", bound="SlidesThemePreset")


@_attrs_define
class SlidesThemePreset:
    """
    Attributes:
        id (str):
        label (str):
        template (SlidesThemePresetTemplate):
    """

    id: str
    label: str
    template: SlidesThemePresetTemplate
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)

    def to_dict(self) -> dict[str, Any]:
        id = self.id

        label = self.label

        template = self.template.to_dict()

        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update(
            {
                "id": id,
                "label": label,
                "template": template,
            }
        )

        return field_dict

    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.slides_theme_preset_template import SlidesThemePresetTemplate

        d = dict(src_dict)
        id = d.pop("id")

        label = d.pop("label")

        template = SlidesThemePresetTemplate.from_dict(d.pop("template"))

        slides_theme_preset = cls(
            id=id,
            label=label,
            template=template,
        )

        slides_theme_preset.additional_properties = d
        return slides_theme_preset

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
