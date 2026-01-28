from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, cast

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

T = TypeVar("T", bound="OutputGenerateRequest")


@_attrs_define
class OutputGenerateRequest:
    """
    Attributes:
        prompt (None | str | Unset):
        chunk_ids (list[int] | None | Unset):
        top_k (int | Unset):  Default: 5.
        min_score (float | Unset):  Default: 0.2.
        model_id (None | str | Unset): Optional model ID to use for generation
    """

    prompt: None | str | Unset = UNSET
    chunk_ids: list[int] | None | Unset = UNSET
    top_k: int | Unset = 5
    min_score: float | Unset = 0.2
    model_id: None | str | Unset = UNSET
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)

    def to_dict(self) -> dict[str, Any]:
        prompt: None | str | Unset
        if isinstance(self.prompt, Unset):
            prompt = UNSET
        else:
            prompt = self.prompt

        chunk_ids: list[int] | None | Unset
        if isinstance(self.chunk_ids, Unset):
            chunk_ids = UNSET
        elif isinstance(self.chunk_ids, list):
            chunk_ids = self.chunk_ids

        else:
            chunk_ids = self.chunk_ids

        top_k = self.top_k

        min_score = self.min_score

        model_id: None | str | Unset
        if isinstance(self.model_id, Unset):
            model_id = UNSET
        else:
            model_id = self.model_id

        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({})
        if prompt is not UNSET:
            field_dict["prompt"] = prompt
        if chunk_ids is not UNSET:
            field_dict["chunk_ids"] = chunk_ids
        if top_k is not UNSET:
            field_dict["top_k"] = top_k
        if min_score is not UNSET:
            field_dict["min_score"] = min_score
        if model_id is not UNSET:
            field_dict["model_id"] = model_id

        return field_dict

    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)

        def _parse_prompt(data: object) -> None | str | Unset:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            return cast(None | str | Unset, data)

        prompt = _parse_prompt(d.pop("prompt", UNSET))

        def _parse_chunk_ids(data: object) -> list[int] | None | Unset:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            try:
                if not isinstance(data, list):
                    raise TypeError()
                chunk_ids_type_0 = cast(list[int], data)

                return chunk_ids_type_0
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            return cast(list[int] | None | Unset, data)

        chunk_ids = _parse_chunk_ids(d.pop("chunk_ids", UNSET))

        top_k = d.pop("top_k", UNSET)

        min_score = d.pop("min_score", UNSET)

        def _parse_model_id(data: object) -> None | str | Unset:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            return cast(None | str | Unset, data)

        model_id = _parse_model_id(d.pop("model_id", UNSET))

        output_generate_request = cls(
            prompt=prompt,
            chunk_ids=chunk_ids,
            top_k=top_k,
            min_score=min_score,
            model_id=model_id,
        )

        output_generate_request.additional_properties = d
        return output_generate_request

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
