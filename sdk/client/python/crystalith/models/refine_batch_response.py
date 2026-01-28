from __future__ import annotations

import datetime
from collections.abc import Mapping
from typing import TYPE_CHECKING, Any, TypeVar

from attrs import define as _attrs_define
from attrs import field as _attrs_field
from dateutil.parser import isoparse

if TYPE_CHECKING:
    from ..models.citation import Citation
    from ..models.refine_batch_response_outputs import RefineBatchResponseOutputs


T = TypeVar("T", bound="RefineBatchResponse")


@_attrs_define
class RefineBatchResponse:
    """
    Attributes:
        outputs (RefineBatchResponseOutputs):
        citations (list[Citation]):
        evidence (bool):
        created_at (datetime.datetime):
    """

    outputs: RefineBatchResponseOutputs
    citations: list[Citation]
    evidence: bool
    created_at: datetime.datetime
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)

    def to_dict(self) -> dict[str, Any]:
        outputs = self.outputs.to_dict()

        citations = []
        for citations_item_data in self.citations:
            citations_item = citations_item_data.to_dict()
            citations.append(citations_item)

        evidence = self.evidence

        created_at = self.created_at.isoformat()

        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update(
            {
                "outputs": outputs,
                "citations": citations,
                "evidence": evidence,
                "created_at": created_at,
            }
        )

        return field_dict

    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.citation import Citation
        from ..models.refine_batch_response_outputs import RefineBatchResponseOutputs

        d = dict(src_dict)
        outputs = RefineBatchResponseOutputs.from_dict(d.pop("outputs"))

        citations = []
        _citations = d.pop("citations")
        for citations_item_data in _citations:
            citations_item = Citation.from_dict(citations_item_data)

            citations.append(citations_item)

        evidence = d.pop("evidence")

        created_at = isoparse(d.pop("created_at"))

        refine_batch_response = cls(
            outputs=outputs,
            citations=citations,
            evidence=evidence,
            created_at=created_at,
        )

        refine_batch_response.additional_properties = d
        return refine_batch_response

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
