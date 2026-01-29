from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

T = TypeVar("T", bound="ExtractorInfoResponse")


@_attrs_define
class ExtractorInfoResponse:
    """Information about an available extractor.

    Attributes:
        type_ (str):
        enabled (bool):
        available (bool):
        display_name (str):
        description (str):
        priority (int):
        requires_api_key (bool | Unset):  Default: False.
        requires_service (bool | Unset):  Default: False.
    """

    type_: str
    enabled: bool
    available: bool
    display_name: str
    description: str
    priority: int
    requires_api_key: bool | Unset = False
    requires_service: bool | Unset = False
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)

    def to_dict(self) -> dict[str, Any]:
        type_ = self.type_

        enabled = self.enabled

        available = self.available

        display_name = self.display_name

        description = self.description

        priority = self.priority

        requires_api_key = self.requires_api_key

        requires_service = self.requires_service

        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update(
            {
                "type": type_,
                "enabled": enabled,
                "available": available,
                "display_name": display_name,
                "description": description,
                "priority": priority,
            }
        )
        if requires_api_key is not UNSET:
            field_dict["requires_api_key"] = requires_api_key
        if requires_service is not UNSET:
            field_dict["requires_service"] = requires_service

        return field_dict

    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        type_ = d.pop("type")

        enabled = d.pop("enabled")

        available = d.pop("available")

        display_name = d.pop("display_name")

        description = d.pop("description")

        priority = d.pop("priority")

        requires_api_key = d.pop("requires_api_key", UNSET)

        requires_service = d.pop("requires_service", UNSET)

        extractor_info_response = cls(
            type_=type_,
            enabled=enabled,
            available=available,
            display_name=display_name,
            description=description,
            priority=priority,
            requires_api_key=requires_api_key,
            requires_service=requires_service,
        )

        extractor_info_response.additional_properties = d
        return extractor_info_response

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
