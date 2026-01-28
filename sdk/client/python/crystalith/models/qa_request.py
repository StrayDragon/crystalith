from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, cast

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

T = TypeVar("T", bound="QARequest")


@_attrs_define
class QARequest:
    """
    Attributes:
        question (str):
        top_k (int | Unset):  Default: 5.
        min_score (float | Unset):  Default: 0.2.
        session_id (int | None | Unset):
    """

    question: str
    top_k: int | Unset = 5
    min_score: float | Unset = 0.2
    session_id: int | None | Unset = UNSET
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)

    def to_dict(self) -> dict[str, Any]:
        question = self.question

        top_k = self.top_k

        min_score = self.min_score

        session_id: int | None | Unset
        if isinstance(self.session_id, Unset):
            session_id = UNSET
        else:
            session_id = self.session_id

        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update(
            {
                "question": question,
            }
        )
        if top_k is not UNSET:
            field_dict["top_k"] = top_k
        if min_score is not UNSET:
            field_dict["min_score"] = min_score
        if session_id is not UNSET:
            field_dict["session_id"] = session_id

        return field_dict

    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        question = d.pop("question")

        top_k = d.pop("top_k", UNSET)

        min_score = d.pop("min_score", UNSET)

        def _parse_session_id(data: object) -> int | None | Unset:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            return cast(int | None | Unset, data)

        session_id = _parse_session_id(d.pop("session_id", UNSET))

        qa_request = cls(
            question=question,
            top_k=top_k,
            min_score=min_score,
            session_id=session_id,
        )

        qa_request.additional_properties = d
        return qa_request

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
