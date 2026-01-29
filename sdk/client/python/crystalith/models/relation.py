from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..models.relation_relation_type import RelationRelationType

T = TypeVar("T", bound="Relation")


@_attrs_define
class Relation:
    """
    Attributes:
        source_chunk_id (int):
        target_chunk_id (int):
        relation_type (RelationRelationType):
        score (float):
    """

    source_chunk_id: int
    target_chunk_id: int
    relation_type: RelationRelationType
    score: float
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)

    def to_dict(self) -> dict[str, Any]:
        source_chunk_id = self.source_chunk_id

        target_chunk_id = self.target_chunk_id

        relation_type = self.relation_type.value

        score = self.score

        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update(
            {
                "source_chunk_id": source_chunk_id,
                "target_chunk_id": target_chunk_id,
                "relation_type": relation_type,
                "score": score,
            }
        )

        return field_dict

    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        source_chunk_id = d.pop("source_chunk_id")

        target_chunk_id = d.pop("target_chunk_id")

        relation_type = RelationRelationType(d.pop("relation_type"))

        score = d.pop("score")

        relation = cls(
            source_chunk_id=source_chunk_id,
            target_chunk_id=target_chunk_id,
            relation_type=relation_type,
            score=score,
        )

        relation.additional_properties = d
        return relation

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
