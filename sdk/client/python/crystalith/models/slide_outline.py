from __future__ import annotations

from collections.abc import Mapping
from typing import TYPE_CHECKING, Any, TypeVar

from attrs import define as _attrs_define

if TYPE_CHECKING:
    from ..models.slide_outline_item import SlideOutlineItem


T = TypeVar("T", bound="SlideOutline")


@_attrs_define
class SlideOutline:
    """
    Attributes:
        title (str):
        slides (list[SlideOutlineItem]):
    """

    title: str
    slides: list[SlideOutlineItem]

    def to_dict(self) -> dict[str, Any]:
        title = self.title

        slides = []
        for slides_item_data in self.slides:
            slides_item = slides_item_data.to_dict()
            slides.append(slides_item)

        field_dict: dict[str, Any] = {}

        field_dict.update(
            {
                "title": title,
                "slides": slides,
            }
        )

        return field_dict

    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.slide_outline_item import SlideOutlineItem

        d = dict(src_dict)
        title = d.pop("title")

        slides = []
        _slides = d.pop("slides")
        for slides_item_data in _slides:
            slides_item = SlideOutlineItem.from_dict(slides_item_data)

            slides.append(slides_item)

        slide_outline = cls(
            title=title,
            slides=slides,
        )

        return slide_outline
