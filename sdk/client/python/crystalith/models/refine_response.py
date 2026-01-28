from __future__ import annotations

import datetime
from collections.abc import Mapping
from typing import TYPE_CHECKING, Any, TypeVar, cast

from attrs import define as _attrs_define
from attrs import field as _attrs_field
from dateutil.parser import isoparse

from ..types import UNSET, Unset

if TYPE_CHECKING:
    from ..models.citation import Citation
    from ..models.structured_refine import StructuredRefine


T = TypeVar("T", bound="RefineResponse")


@_attrs_define
class RefineResponse:
    """
    Attributes:
        format_ (str):
        citations (list[Citation]):
        evidence (bool):
        created_at (datetime.datetime):
        paragraph (None | str | Unset):
        bullets (list[str] | None | Unset):
        structured (None | StructuredRefine | Unset):
    """

    format_: str
    citations: list[Citation]
    evidence: bool
    created_at: datetime.datetime
    paragraph: None | str | Unset = UNSET
    bullets: list[str] | None | Unset = UNSET
    structured: None | StructuredRefine | Unset = UNSET
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)

    def to_dict(self) -> dict[str, Any]:
        from ..models.structured_refine import StructuredRefine

        format_ = self.format_

        citations = []
        for citations_item_data in self.citations:
            citations_item = citations_item_data.to_dict()
            citations.append(citations_item)

        evidence = self.evidence

        created_at = self.created_at.isoformat()

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
        field_dict.update(
            {
                "format": format_,
                "citations": citations,
                "evidence": evidence,
                "created_at": created_at,
            }
        )
        if paragraph is not UNSET:
            field_dict["paragraph"] = paragraph
        if bullets is not UNSET:
            field_dict["bullets"] = bullets
        if structured is not UNSET:
            field_dict["structured"] = structured

        return field_dict

    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.citation import Citation
        from ..models.structured_refine import StructuredRefine

        d = dict(src_dict)
        format_ = d.pop("format")

        citations = []
        _citations = d.pop("citations")
        for citations_item_data in _citations:
            citations_item = Citation.from_dict(citations_item_data)

            citations.append(citations_item)

        evidence = d.pop("evidence")

        created_at = isoparse(d.pop("created_at"))

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

        refine_response = cls(
            format_=format_,
            citations=citations,
            evidence=evidence,
            created_at=created_at,
            paragraph=paragraph,
            bullets=bullets,
            structured=structured,
        )

        refine_response.additional_properties = d
        return refine_response

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
