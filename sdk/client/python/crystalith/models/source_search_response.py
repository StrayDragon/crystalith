from __future__ import annotations

import datetime
from collections.abc import Mapping
from typing import TYPE_CHECKING, Any, TypeVar, cast

from attrs import define as _attrs_define
from attrs import field as _attrs_field
from dateutil.parser import isoparse

from ..models.source_search_response_source_search_status import SourceSearchResponseSourceSearchStatus
from ..types import UNSET, Unset

if TYPE_CHECKING:
    from ..models.source_search_result import SourceSearchResult


T = TypeVar("T", bound="SourceSearchResponse")


@_attrs_define
class SourceSearchResponse:
    """
    Attributes:
        status (SourceSearchResponseSourceSearchStatus): 枚举值:

            * `ok`: 搜索成功
            * `not_implemented`: 功能未实现
        query (str):
        engine (str):
        mode (str):
        results (list[SourceSearchResult]):
        created_at (datetime.datetime):
        message (None | str | Unset):
    """

    status: SourceSearchResponseSourceSearchStatus
    query: str
    engine: str
    mode: str
    results: list[SourceSearchResult]
    created_at: datetime.datetime
    message: None | str | Unset = UNSET
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)

    def to_dict(self) -> dict[str, Any]:
        status = self.status.value

        query = self.query

        engine = self.engine

        mode = self.mode

        results = []
        for results_item_data in self.results:
            results_item = results_item_data.to_dict()
            results.append(results_item)

        created_at = self.created_at.isoformat()

        message: None | str | Unset
        if isinstance(self.message, Unset):
            message = UNSET
        else:
            message = self.message

        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update(
            {
                "status": status,
                "query": query,
                "engine": engine,
                "mode": mode,
                "results": results,
                "created_at": created_at,
            }
        )
        if message is not UNSET:
            field_dict["message"] = message

        return field_dict

    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.source_search_result import SourceSearchResult

        d = dict(src_dict)
        status = SourceSearchResponseSourceSearchStatus(d.pop("status"))

        query = d.pop("query")

        engine = d.pop("engine")

        mode = d.pop("mode")

        results = []
        _results = d.pop("results")
        for results_item_data in _results:
            results_item = SourceSearchResult.from_dict(results_item_data)

            results.append(results_item)

        created_at = isoparse(d.pop("created_at"))

        def _parse_message(data: object) -> None | str | Unset:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            return cast(None | str | Unset, data)

        message = _parse_message(d.pop("message", UNSET))

        source_search_response = cls(
            status=status,
            query=query,
            engine=engine,
            mode=mode,
            results=results,
            created_at=created_at,
            message=message,
        )

        source_search_response.additional_properties = d
        return source_search_response

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
