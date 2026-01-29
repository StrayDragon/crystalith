from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

T = TypeVar("T", bound="ExportResearchRequest")


@_attrs_define
class ExportResearchRequest:
    """Request model for exporting research results.

    Attributes:
        export_type (str | Unset): Export type: 'source' or 'note' Default: 'source'.
        include_report (bool | Unset): Include final report Default: True.
        include_results (bool | Unset): Include aggregated results as links Default: False.
    """

    export_type: str | Unset = "source"
    include_report: bool | Unset = True
    include_results: bool | Unset = False
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)

    def to_dict(self) -> dict[str, Any]:
        export_type = self.export_type

        include_report = self.include_report

        include_results = self.include_results

        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({})
        if export_type is not UNSET:
            field_dict["export_type"] = export_type
        if include_report is not UNSET:
            field_dict["include_report"] = include_report
        if include_results is not UNSET:
            field_dict["include_results"] = include_results

        return field_dict

    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        export_type = d.pop("export_type", UNSET)

        include_report = d.pop("include_report", UNSET)

        include_results = d.pop("include_results", UNSET)

        export_research_request = cls(
            export_type=export_type,
            include_report=include_report,
            include_results=include_results,
        )

        export_research_request.additional_properties = d
        return export_research_request

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
