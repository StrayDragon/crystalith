from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, cast

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

T = TypeVar("T", bound="ApproveRequest")


@_attrs_define
class ApproveRequest:
    """Request to approve a search plan.

    Attributes:
        feedback (None | str | Unset): Optional feedback on the plan
    """

    feedback: None | str | Unset = UNSET
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)

    def to_dict(self) -> dict[str, Any]:
        feedback: None | str | Unset
        if isinstance(self.feedback, Unset):
            feedback = UNSET
        else:
            feedback = self.feedback

        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({})
        if feedback is not UNSET:
            field_dict["feedback"] = feedback

        return field_dict

    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)

        def _parse_feedback(data: object) -> None | str | Unset:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            return cast(None | str | Unset, data)

        feedback = _parse_feedback(d.pop("feedback", UNSET))

        approve_request = cls(
            feedback=feedback,
        )

        approve_request.additional_properties = d
        return approve_request

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
