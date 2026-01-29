from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar

from attrs import define as _attrs_define
from attrs import field as _attrs_field

T = TypeVar("T", bound="ContextStatsResponse")


@_attrs_define
class ContextStatsResponse:
    """
    Attributes:
        total_tokens (int):
        system_tokens (int):
        history_tokens (int):
        retrieval_tokens (int):
        query_tokens (int):
        max_tokens (int):
        compressed (bool):
    """

    total_tokens: int
    system_tokens: int
    history_tokens: int
    retrieval_tokens: int
    query_tokens: int
    max_tokens: int
    compressed: bool
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)

    def to_dict(self) -> dict[str, Any]:
        total_tokens = self.total_tokens

        system_tokens = self.system_tokens

        history_tokens = self.history_tokens

        retrieval_tokens = self.retrieval_tokens

        query_tokens = self.query_tokens

        max_tokens = self.max_tokens

        compressed = self.compressed

        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update(
            {
                "total_tokens": total_tokens,
                "system_tokens": system_tokens,
                "history_tokens": history_tokens,
                "retrieval_tokens": retrieval_tokens,
                "query_tokens": query_tokens,
                "max_tokens": max_tokens,
                "compressed": compressed,
            }
        )

        return field_dict

    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        total_tokens = d.pop("total_tokens")

        system_tokens = d.pop("system_tokens")

        history_tokens = d.pop("history_tokens")

        retrieval_tokens = d.pop("retrieval_tokens")

        query_tokens = d.pop("query_tokens")

        max_tokens = d.pop("max_tokens")

        compressed = d.pop("compressed")

        context_stats_response = cls(
            total_tokens=total_tokens,
            system_tokens=system_tokens,
            history_tokens=history_tokens,
            retrieval_tokens=retrieval_tokens,
            query_tokens=query_tokens,
            max_tokens=max_tokens,
            compressed=compressed,
        )

        context_stats_response.additional_properties = d
        return context_stats_response

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
