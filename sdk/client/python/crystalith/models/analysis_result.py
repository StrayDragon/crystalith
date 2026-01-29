from __future__ import annotations

from collections.abc import Mapping
from typing import TYPE_CHECKING, Any, TypeVar

from attrs import define as _attrs_define
from attrs import field as _attrs_field

if TYPE_CHECKING:
    from ..models.relation import Relation
    from ..models.topic import Topic


T = TypeVar("T", bound="AnalysisResult")


@_attrs_define
class AnalysisResult:
    """
    Attributes:
        topics (list[Topic]):
        relations (list[Relation]):
        contradictions (list[Relation]):
    """

    topics: list[Topic]
    relations: list[Relation]
    contradictions: list[Relation]
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)

    def to_dict(self) -> dict[str, Any]:
        topics = []
        for topics_item_data in self.topics:
            topics_item = topics_item_data.to_dict()
            topics.append(topics_item)

        relations = []
        for relations_item_data in self.relations:
            relations_item = relations_item_data.to_dict()
            relations.append(relations_item)

        contradictions = []
        for contradictions_item_data in self.contradictions:
            contradictions_item = contradictions_item_data.to_dict()
            contradictions.append(contradictions_item)

        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update(
            {
                "topics": topics,
                "relations": relations,
                "contradictions": contradictions,
            }
        )

        return field_dict

    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.relation import Relation
        from ..models.topic import Topic

        d = dict(src_dict)
        topics = []
        _topics = d.pop("topics")
        for topics_item_data in _topics:
            topics_item = Topic.from_dict(topics_item_data)

            topics.append(topics_item)

        relations = []
        _relations = d.pop("relations")
        for relations_item_data in _relations:
            relations_item = Relation.from_dict(relations_item_data)

            relations.append(relations_item)

        contradictions = []
        _contradictions = d.pop("contradictions")
        for contradictions_item_data in _contradictions:
            contradictions_item = Relation.from_dict(contradictions_item_data)

            contradictions.append(contradictions_item)

        analysis_result = cls(
            topics=topics,
            relations=relations,
            contradictions=contradictions,
        )

        analysis_result.additional_properties = d
        return analysis_result

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
