from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, cast

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

T = TypeVar("T", bound="Citation")


@_attrs_define
class Citation:
    """
    Attributes:
        source_id (int):
        source_name (str):
        chunk_id (int):
        chunk_index (int):
        snippet (str):
        page_number (int | None | Unset):
        paragraph_index (int | None | Unset):
        score (float | None | Unset):
    """

    source_id: int
    source_name: str
    chunk_id: int
    chunk_index: int
    snippet: str
    page_number: int | None | Unset = UNSET
    paragraph_index: int | None | Unset = UNSET
    score: float | None | Unset = UNSET
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)

    def to_dict(self) -> dict[str, Any]:
        source_id = self.source_id

        source_name = self.source_name

        chunk_id = self.chunk_id

        chunk_index = self.chunk_index

        snippet = self.snippet

        page_number: int | None | Unset
        if isinstance(self.page_number, Unset):
            page_number = UNSET
        else:
            page_number = self.page_number

        paragraph_index: int | None | Unset
        if isinstance(self.paragraph_index, Unset):
            paragraph_index = UNSET
        else:
            paragraph_index = self.paragraph_index

        score: float | None | Unset
        if isinstance(self.score, Unset):
            score = UNSET
        else:
            score = self.score

        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update(
            {
                "source_id": source_id,
                "source_name": source_name,
                "chunk_id": chunk_id,
                "chunk_index": chunk_index,
                "snippet": snippet,
            }
        )
        if page_number is not UNSET:
            field_dict["page_number"] = page_number
        if paragraph_index is not UNSET:
            field_dict["paragraph_index"] = paragraph_index
        if score is not UNSET:
            field_dict["score"] = score

        return field_dict

    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        source_id = d.pop("source_id")

        source_name = d.pop("source_name")

        chunk_id = d.pop("chunk_id")

        chunk_index = d.pop("chunk_index")

        snippet = d.pop("snippet")

        def _parse_page_number(data: object) -> int | None | Unset:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            return cast(int | None | Unset, data)

        page_number = _parse_page_number(d.pop("page_number", UNSET))

        def _parse_paragraph_index(data: object) -> int | None | Unset:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            return cast(int | None | Unset, data)

        paragraph_index = _parse_paragraph_index(d.pop("paragraph_index", UNSET))

        def _parse_score(data: object) -> float | None | Unset:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            return cast(float | None | Unset, data)

        score = _parse_score(d.pop("score", UNSET))

        citation = cls(
            source_id=source_id,
            source_name=source_name,
            chunk_id=chunk_id,
            chunk_index=chunk_index,
            snippet=snippet,
            page_number=page_number,
            paragraph_index=paragraph_index,
            score=score,
        )

        citation.additional_properties = d
        return citation

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
