from __future__ import annotations

from collections.abc import Mapping
from typing import TYPE_CHECKING, Any, TypeVar, cast

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

if TYPE_CHECKING:
    from ..models.extractor_info_response import ExtractorInfoResponse


T = TypeVar("T", bound="ExtractorsListResponse")


@_attrs_define
class ExtractorsListResponse:
    """Response for listing available extractors.

    Attributes:
        extractors (list[ExtractorInfoResponse]):
        default_extractor (None | str | Unset):
        fallback_enabled (bool | Unset):  Default: True.
    """

    extractors: list[ExtractorInfoResponse]
    default_extractor: None | str | Unset = UNSET
    fallback_enabled: bool | Unset = True
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)

    def to_dict(self) -> dict[str, Any]:
        extractors = []
        for extractors_item_data in self.extractors:
            extractors_item = extractors_item_data.to_dict()
            extractors.append(extractors_item)

        default_extractor: None | str | Unset
        if isinstance(self.default_extractor, Unset):
            default_extractor = UNSET
        else:
            default_extractor = self.default_extractor

        fallback_enabled = self.fallback_enabled

        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update(
            {
                "extractors": extractors,
            }
        )
        if default_extractor is not UNSET:
            field_dict["default_extractor"] = default_extractor
        if fallback_enabled is not UNSET:
            field_dict["fallback_enabled"] = fallback_enabled

        return field_dict

    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.extractor_info_response import ExtractorInfoResponse

        d = dict(src_dict)
        extractors = []
        _extractors = d.pop("extractors")
        for extractors_item_data in _extractors:
            extractors_item = ExtractorInfoResponse.from_dict(extractors_item_data)

            extractors.append(extractors_item)

        def _parse_default_extractor(data: object) -> None | str | Unset:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            return cast(None | str | Unset, data)

        default_extractor = _parse_default_extractor(d.pop("default_extractor", UNSET))

        fallback_enabled = d.pop("fallback_enabled", UNSET)

        extractors_list_response = cls(
            extractors=extractors,
            default_extractor=default_extractor,
            fallback_enabled=fallback_enabled,
        )

        extractors_list_response.additional_properties = d
        return extractors_list_response

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
