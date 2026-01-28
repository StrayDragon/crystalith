from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, cast

from attrs import define as _attrs_define

from ..types import UNSET, Unset

T = TypeVar("T", bound="SlideOutlineItem")


@_attrs_define
class SlideOutlineItem:
    """
    Attributes:
        title (str):
        bullets (list[str] | Unset):
    """

    title: str
    bullets: list[str] | Unset = UNSET

    def to_dict(self) -> dict[str, Any]:
        title = self.title

        bullets: list[str] | Unset = UNSET
        if not isinstance(self.bullets, Unset):
            bullets = self.bullets

        field_dict: dict[str, Any] = {}

        field_dict.update(
            {
                "title": title,
            }
        )
        if bullets is not UNSET:
            field_dict["bullets"] = bullets

        return field_dict

    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        title = d.pop("title")

        bullets = cast(list[str], d.pop("bullets", UNSET))

        slide_outline_item = cls(
            title=title,
            bullets=bullets,
        )

        return slide_outline_item
