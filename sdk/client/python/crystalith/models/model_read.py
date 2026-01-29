from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, cast

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..models.model_read_provider import ModelReadProvider
from ..types import UNSET, Unset

T = TypeVar("T", bound="ModelRead")


@_attrs_define
class ModelRead:
    """Response model for a single AI model.

    Attributes:
        id (str):
        provider (ModelReadProvider):
        model (str):
        display_name (str):
        description (str):
        roles (list[str] | Unset): Model roles: chat, embed, edit, etc.
        capabilities (list[str] | Unset): Special capabilities: tool_use, image_input, etc.
    """

    id: str
    provider: ModelReadProvider
    model: str
    display_name: str
    description: str
    roles: list[str] | Unset = UNSET
    capabilities: list[str] | Unset = UNSET
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)

    def to_dict(self) -> dict[str, Any]:
        id = self.id

        provider = self.provider.value

        model = self.model

        display_name = self.display_name

        description = self.description

        roles: list[str] | Unset = UNSET
        if not isinstance(self.roles, Unset):
            roles = self.roles

        capabilities: list[str] | Unset = UNSET
        if not isinstance(self.capabilities, Unset):
            capabilities = self.capabilities

        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update(
            {
                "id": id,
                "provider": provider,
                "model": model,
                "display_name": display_name,
                "description": description,
            }
        )
        if roles is not UNSET:
            field_dict["roles"] = roles
        if capabilities is not UNSET:
            field_dict["capabilities"] = capabilities

        return field_dict

    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        id = d.pop("id")

        provider = ModelReadProvider(d.pop("provider"))

        model = d.pop("model")

        display_name = d.pop("display_name")

        description = d.pop("description")

        roles = cast(list[str], d.pop("roles", UNSET))

        capabilities = cast(list[str], d.pop("capabilities", UNSET))

        model_read = cls(
            id=id,
            provider=provider,
            model=model,
            display_name=display_name,
            description=description,
            roles=roles,
            capabilities=capabilities,
        )

        model_read.additional_properties = d
        return model_read

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
