from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, cast

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

T = TypeVar("T", bound="ExportResearchResponse")


@_attrs_define
class ExportResearchResponse:
    """Response model for export operation.

    Attributes:
        success (bool):
        message (str):
        source_id (int | None | Unset):
        note_id (int | None | Unset):
    """

    success: bool
    message: str
    source_id: int | None | Unset = UNSET
    note_id: int | None | Unset = UNSET
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)

    def to_dict(self) -> dict[str, Any]:
        success = self.success

        message = self.message

        source_id: int | None | Unset
        if isinstance(self.source_id, Unset):
            source_id = UNSET
        else:
            source_id = self.source_id

        note_id: int | None | Unset
        if isinstance(self.note_id, Unset):
            note_id = UNSET
        else:
            note_id = self.note_id

        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update(
            {
                "success": success,
                "message": message,
            }
        )
        if source_id is not UNSET:
            field_dict["source_id"] = source_id
        if note_id is not UNSET:
            field_dict["note_id"] = note_id

        return field_dict

    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        success = d.pop("success")

        message = d.pop("message")

        def _parse_source_id(data: object) -> int | None | Unset:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            return cast(int | None | Unset, data)

        source_id = _parse_source_id(d.pop("source_id", UNSET))

        def _parse_note_id(data: object) -> int | None | Unset:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            return cast(int | None | Unset, data)

        note_id = _parse_note_id(d.pop("note_id", UNSET))

        export_research_response = cls(
            success=success,
            message=message,
            source_id=source_id,
            note_id=note_id,
        )

        export_research_response.additional_properties = d
        return export_research_response

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
