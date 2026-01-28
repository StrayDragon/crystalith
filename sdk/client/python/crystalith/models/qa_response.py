from __future__ import annotations

import datetime
from collections.abc import Mapping
from typing import TYPE_CHECKING, Any, TypeVar

from attrs import define as _attrs_define
from attrs import field as _attrs_field
from dateutil.parser import isoparse

if TYPE_CHECKING:
    from ..models.citation import Citation
    from ..models.context_stats_response import ContextStatsResponse


T = TypeVar("T", bound="QAResponse")


@_attrs_define
class QAResponse:
    """
    Attributes:
        answer (str):
        citations (list[Citation]):
        evidence (bool):
        confidence (float):
        created_at (datetime.datetime):
        context (ContextStatsResponse):
    """

    answer: str
    citations: list[Citation]
    evidence: bool
    confidence: float
    created_at: datetime.datetime
    context: ContextStatsResponse
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)

    def to_dict(self) -> dict[str, Any]:
        answer = self.answer

        citations = []
        for citations_item_data in self.citations:
            citations_item = citations_item_data.to_dict()
            citations.append(citations_item)

        evidence = self.evidence

        confidence = self.confidence

        created_at = self.created_at.isoformat()

        context = self.context.to_dict()

        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update(
            {
                "answer": answer,
                "citations": citations,
                "evidence": evidence,
                "confidence": confidence,
                "created_at": created_at,
                "context": context,
            }
        )

        return field_dict

    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.citation import Citation
        from ..models.context_stats_response import ContextStatsResponse

        d = dict(src_dict)
        answer = d.pop("answer")

        citations = []
        _citations = d.pop("citations")
        for citations_item_data in _citations:
            citations_item = Citation.from_dict(citations_item_data)

            citations.append(citations_item)

        evidence = d.pop("evidence")

        confidence = d.pop("confidence")

        created_at = isoparse(d.pop("created_at"))

        context = ContextStatsResponse.from_dict(d.pop("context"))

        qa_response = cls(
            answer=answer,
            citations=citations,
            evidence=evidence,
            confidence=confidence,
            created_at=created_at,
            context=context,
        )

        qa_response.additional_properties = d
        return qa_response

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
