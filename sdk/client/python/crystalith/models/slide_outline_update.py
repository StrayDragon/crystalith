from __future__ import annotations

from collections.abc import Mapping
from typing import TYPE_CHECKING, Any, TypeVar

from attrs import define as _attrs_define
from attrs import field as _attrs_field

if TYPE_CHECKING:
    from ..models.slide_outline import SlideOutline


T = TypeVar("T", bound="SlideOutlineUpdate")


@_attrs_define
class SlideOutlineUpdate:
    """
    Attributes:
        outline (SlideOutline):
    """

    outline: SlideOutline
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)

    def to_dict(self) -> dict[str, Any]:
        outline = self.outline.to_dict()

        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update(
            {
                "outline": outline,
            }
        )

        return field_dict

    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.slide_outline import SlideOutline

        d = dict(src_dict)
        outline = SlideOutline.from_dict(d.pop("outline"))

        slide_outline_update = cls(
            outline=outline,
        )

        slide_outline_update.additional_properties = d
        return slide_outline_update

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
