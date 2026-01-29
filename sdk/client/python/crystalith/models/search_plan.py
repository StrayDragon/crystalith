from __future__ import annotations

from collections.abc import Mapping
from typing import TYPE_CHECKING, Any, TypeVar

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

if TYPE_CHECKING:
    from ..models.search_query import SearchQuery


T = TypeVar("T", bound="SearchPlan")


@_attrs_define
class SearchPlan:
    """A search plan for one iteration.

    Attributes:
        iteration (int): Iteration number
        queries (list[SearchQuery] | Unset): Queries to execute
        reasoning (str | Unset): Agent reasoning for this plan Default: ''.
        estimated_results (int | Unset): Estimated number of results Default: 10.
    """

    iteration: int
    queries: list[SearchQuery] | Unset = UNSET
    reasoning: str | Unset = ""
    estimated_results: int | Unset = 10
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)

    def to_dict(self) -> dict[str, Any]:
        iteration = self.iteration

        queries: list[dict[str, Any]] | Unset = UNSET
        if not isinstance(self.queries, Unset):
            queries = []
            for queries_item_data in self.queries:
                queries_item = queries_item_data.to_dict()
                queries.append(queries_item)

        reasoning = self.reasoning

        estimated_results = self.estimated_results

        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update(
            {
                "iteration": iteration,
            }
        )
        if queries is not UNSET:
            field_dict["queries"] = queries
        if reasoning is not UNSET:
            field_dict["reasoning"] = reasoning
        if estimated_results is not UNSET:
            field_dict["estimated_results"] = estimated_results

        return field_dict

    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.search_query import SearchQuery

        d = dict(src_dict)
        iteration = d.pop("iteration")

        _queries = d.pop("queries", UNSET)
        queries: list[SearchQuery] | Unset = UNSET
        if _queries is not UNSET:
            queries = []
            for queries_item_data in _queries:
                queries_item = SearchQuery.from_dict(queries_item_data)

                queries.append(queries_item)

        reasoning = d.pop("reasoning", UNSET)

        estimated_results = d.pop("estimated_results", UNSET)

        search_plan = cls(
            iteration=iteration,
            queries=queries,
            reasoning=reasoning,
            estimated_results=estimated_results,
        )

        search_plan.additional_properties = d
        return search_plan

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
