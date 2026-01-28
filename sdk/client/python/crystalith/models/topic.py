from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, cast

from attrs import define as _attrs_define
from attrs import field as _attrs_field

T = TypeVar("T", bound="Topic")


@_attrs_define
class Topic:
    """
    Attributes:
        id (str):
        name (str):
        chunk_ids (list[int]):
        keywords (list[str]):
    """

    id: str
    name: str
    chunk_ids: list[int]
    keywords: list[str]
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)

    def to_dict(self) -> dict[str, Any]:
        id = self.id

        name = self.name

        chunk_ids = self.chunk_ids

        keywords = self.keywords

        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update(
            {
                "id": id,
                "name": name,
                "chunk_ids": chunk_ids,
                "keywords": keywords,
            }
        )

        return field_dict

    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        id = d.pop("id")

        name = d.pop("name")

        chunk_ids = cast(list[int], d.pop("chunk_ids"))

        keywords = cast(list[str], d.pop("keywords"))

        topic = cls(
            id=id,
            name=name,
            chunk_ids=chunk_ids,
            keywords=keywords,
        )

        topic.additional_properties = d
        return topic

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
