from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar

from attrs import define as _attrs_define
from attrs import field as _attrs_field

T = TypeVar("T", bound="ConvertToSourceResponse")


@_attrs_define
class ConvertToSourceResponse:
    """
    Attributes:
        source_id (int):
        filename (str):
        chunk_count (int):
    """

    source_id: int
    filename: str
    chunk_count: int
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)

    def to_dict(self) -> dict[str, Any]:
        source_id = self.source_id

        filename = self.filename

        chunk_count = self.chunk_count

        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update(
            {
                "source_id": source_id,
                "filename": filename,
                "chunk_count": chunk_count,
            }
        )

        return field_dict

    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        source_id = d.pop("source_id")

        filename = d.pop("filename")

        chunk_count = d.pop("chunk_count")

        convert_to_source_response = cls(
            source_id=source_id,
            filename=filename,
            chunk_count=chunk_count,
        )

        convert_to_source_response.additional_properties = d
        return convert_to_source_response

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
