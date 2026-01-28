from __future__ import annotations

from collections.abc import Mapping
from typing import TYPE_CHECKING, Any, TypeVar, cast

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

if TYPE_CHECKING:
    from ..models.structured_refine import StructuredRefine


T = TypeVar("T", bound="RefineBatchOutput")


@_attrs_define
class RefineBatchOutput:
    """
    Attributes:
        paragraph (None | str | Unset):
        bullets (list[str] | None | Unset):
        structured (None | StructuredRefine | Unset):
    """

    paragraph: None | str | Unset = UNSET
    bullets: list[str] | None | Unset = UNSET
    structured: None | StructuredRefine | Unset = UNSET
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)

    def to_dict(self) -> dict[str, Any]:
        from ..models.structured_refine import StructuredRefine

        paragraph: None | str | Unset
        if isinstance(self.paragraph, Unset):
            paragraph = UNSET
        else:
            paragraph = self.paragraph

        bullets: list[str] | None | Unset
        if isinstance(self.bullets, Unset):
            bullets = UNSET
        elif isinstance(self.bullets, list):
            bullets = self.bullets

        else:
            bullets = self.bullets

        structured: dict[str, Any] | None | Unset
        if isinstance(self.structured, Unset):
            structured = UNSET
        elif isinstance(self.structured, StructuredRefine):
            structured = self.structured.to_dict()
        else:
            structured = self.structured

        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({})
        if paragraph is not UNSET:
            field_dict["paragraph"] = paragraph
        if bullets is not UNSET:
            field_dict["bullets"] = bullets
        if structured is not UNSET:
            field_dict["structured"] = structured

        return field_dict

    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.structured_refine import StructuredRefine

        d = dict(src_dict)

        def _parse_paragraph(data: object) -> None | str | Unset:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            return cast(None | str | Unset, data)

        paragraph = _parse_paragraph(d.pop("paragraph", UNSET))

        def _parse_bullets(data: object) -> list[str] | None | Unset:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            try:
                if not isinstance(data, list):
                    raise TypeError()
                bullets_type_0 = cast(list[str], data)

                return bullets_type_0
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            return cast(list[str] | None | Unset, data)

        bullets = _parse_bullets(d.pop("bullets", UNSET))

        def _parse_structured(data: object) -> None | StructuredRefine | Unset:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            try:
                if not isinstance(data, dict):
                    raise TypeError()
                structured_type_0 = StructuredRefine.from_dict(data)

                return structured_type_0
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            return cast(None | StructuredRefine | Unset, data)

        structured = _parse_structured(d.pop("structured", UNSET))

        refine_batch_output = cls(
            paragraph=paragraph,
            bullets=bullets,
            structured=structured,
        )

        refine_batch_output.additional_properties = d
        return refine_batch_output

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
