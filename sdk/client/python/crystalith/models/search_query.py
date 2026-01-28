from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

T = TypeVar("T", bound="SearchQuery")


@_attrs_define
class SearchQuery:
    """A single search query in a search plan.

    Attributes:
        query (str): Search query string
        engine (str | Unset): Search engine: Web, Scholar, Docs Default: 'Web'.
        priority (int | Unset): Priority: 1=high, 2=medium, 3=low Default: 1.
        reason (str | Unset): Reason for this query Default: ''.
    """

    query: str
    engine: str | Unset = "Web"
    priority: int | Unset = 1
    reason: str | Unset = ""
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)

    def to_dict(self) -> dict[str, Any]:
        query = self.query

        engine = self.engine

        priority = self.priority

        reason = self.reason

        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update(
            {
                "query": query,
            }
        )
        if engine is not UNSET:
            field_dict["engine"] = engine
        if priority is not UNSET:
            field_dict["priority"] = priority
        if reason is not UNSET:
            field_dict["reason"] = reason

        return field_dict

    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        query = d.pop("query")

        engine = d.pop("engine", UNSET)

        priority = d.pop("priority", UNSET)

        reason = d.pop("reason", UNSET)

        search_query = cls(
            query=query,
            engine=engine,
            priority=priority,
            reason=reason,
        )

        search_query.additional_properties = d
        return search_query

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
