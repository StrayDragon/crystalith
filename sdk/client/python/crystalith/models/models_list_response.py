from __future__ import annotations

from collections.abc import Mapping
from typing import TYPE_CHECKING, Any, TypeVar, cast

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

if TYPE_CHECKING:
    from ..models.model_read import ModelRead


T = TypeVar("T", bound="ModelsListResponse")


@_attrs_define
class ModelsListResponse:
    """Response model for the models list endpoint.

    Attributes:
        models (list[ModelRead]):
        default_chat (None | str | Unset):
        default_embedding (None | str | Unset):
    """

    models: list[ModelRead]
    default_chat: None | str | Unset = UNSET
    default_embedding: None | str | Unset = UNSET
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)

    def to_dict(self) -> dict[str, Any]:
        models = []
        for models_item_data in self.models:
            models_item = models_item_data.to_dict()
            models.append(models_item)

        default_chat: None | str | Unset
        if isinstance(self.default_chat, Unset):
            default_chat = UNSET
        else:
            default_chat = self.default_chat

        default_embedding: None | str | Unset
        if isinstance(self.default_embedding, Unset):
            default_embedding = UNSET
        else:
            default_embedding = self.default_embedding

        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update(
            {
                "models": models,
            }
        )
        if default_chat is not UNSET:
            field_dict["default_chat"] = default_chat
        if default_embedding is not UNSET:
            field_dict["default_embedding"] = default_embedding

        return field_dict

    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.model_read import ModelRead

        d = dict(src_dict)
        models = []
        _models = d.pop("models")
        for models_item_data in _models:
            models_item = ModelRead.from_dict(models_item_data)

            models.append(models_item)

        def _parse_default_chat(data: object) -> None | str | Unset:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            return cast(None | str | Unset, data)

        default_chat = _parse_default_chat(d.pop("default_chat", UNSET))

        def _parse_default_embedding(data: object) -> None | str | Unset:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            return cast(None | str | Unset, data)

        default_embedding = _parse_default_embedding(d.pop("default_embedding", UNSET))

        models_list_response = cls(
            models=models,
            default_chat=default_chat,
            default_embedding=default_embedding,
        )

        models_list_response.additional_properties = d
        return models_list_response

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
