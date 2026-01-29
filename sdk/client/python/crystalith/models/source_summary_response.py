from __future__ import annotations

import datetime
from collections.abc import Mapping
from typing import Any, TypeVar, cast

from attrs import define as _attrs_define
from attrs import field as _attrs_field
from dateutil.parser import isoparse

T = TypeVar("T", bound="SourceSummaryResponse")


@_attrs_define
class SourceSummaryResponse:
    """Response for source summary.

    Attributes:
        source_id (int):
        summary (str):
        key_points (list[str]):
        topics (list[str]):
        word_count (int):
        generated_at (datetime.datetime):
    """

    source_id: int
    summary: str
    key_points: list[str]
    topics: list[str]
    word_count: int
    generated_at: datetime.datetime
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)

    def to_dict(self) -> dict[str, Any]:
        source_id = self.source_id

        summary = self.summary

        key_points = self.key_points

        topics = self.topics

        word_count = self.word_count

        generated_at = self.generated_at.isoformat()

        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update(
            {
                "source_id": source_id,
                "summary": summary,
                "key_points": key_points,
                "topics": topics,
                "word_count": word_count,
                "generated_at": generated_at,
            }
        )

        return field_dict

    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        source_id = d.pop("source_id")

        summary = d.pop("summary")

        key_points = cast(list[str], d.pop("key_points"))

        topics = cast(list[str], d.pop("topics"))

        word_count = d.pop("word_count")

        generated_at = isoparse(d.pop("generated_at"))

        source_summary_response = cls(
            source_id=source_id,
            summary=summary,
            key_points=key_points,
            topics=topics,
            word_count=word_count,
            generated_at=generated_at,
        )

        source_summary_response.additional_properties = d
        return source_summary_response

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
