from __future__ import annotations

from collections.abc import Mapping
from typing import TYPE_CHECKING, Any, TypeVar, cast

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

if TYPE_CHECKING:
    from ..models.config_option import ConfigOption


T = TypeVar("T", bound="ToolConfigResponse")


@_attrs_define
class ToolConfigResponse:
    """Configuration options for a specific tool.

    Attributes:
        tool_id (str):
        tool_label (str):
        quantity_options (list[ConfigOption] | None | Unset):
        difficulty_options (list[ConfigOption] | None | Unset):
        topic_placeholder (None | str | Unset):
        supports_topic (bool | Unset):  Default: True.
    """

    tool_id: str
    tool_label: str
    quantity_options: list[ConfigOption] | None | Unset = UNSET
    difficulty_options: list[ConfigOption] | None | Unset = UNSET
    topic_placeholder: None | str | Unset = UNSET
    supports_topic: bool | Unset = True
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)

    def to_dict(self) -> dict[str, Any]:
        tool_id = self.tool_id

        tool_label = self.tool_label

        quantity_options: list[dict[str, Any]] | None | Unset
        if isinstance(self.quantity_options, Unset):
            quantity_options = UNSET
        elif isinstance(self.quantity_options, list):
            quantity_options = []
            for quantity_options_type_0_item_data in self.quantity_options:
                quantity_options_type_0_item = quantity_options_type_0_item_data.to_dict()
                quantity_options.append(quantity_options_type_0_item)

        else:
            quantity_options = self.quantity_options

        difficulty_options: list[dict[str, Any]] | None | Unset
        if isinstance(self.difficulty_options, Unset):
            difficulty_options = UNSET
        elif isinstance(self.difficulty_options, list):
            difficulty_options = []
            for difficulty_options_type_0_item_data in self.difficulty_options:
                difficulty_options_type_0_item = difficulty_options_type_0_item_data.to_dict()
                difficulty_options.append(difficulty_options_type_0_item)

        else:
            difficulty_options = self.difficulty_options

        topic_placeholder: None | str | Unset
        if isinstance(self.topic_placeholder, Unset):
            topic_placeholder = UNSET
        else:
            topic_placeholder = self.topic_placeholder

        supports_topic = self.supports_topic

        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update(
            {
                "tool_id": tool_id,
                "tool_label": tool_label,
            }
        )
        if quantity_options is not UNSET:
            field_dict["quantity_options"] = quantity_options
        if difficulty_options is not UNSET:
            field_dict["difficulty_options"] = difficulty_options
        if topic_placeholder is not UNSET:
            field_dict["topic_placeholder"] = topic_placeholder
        if supports_topic is not UNSET:
            field_dict["supports_topic"] = supports_topic

        return field_dict

    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.config_option import ConfigOption

        d = dict(src_dict)
        tool_id = d.pop("tool_id")

        tool_label = d.pop("tool_label")

        def _parse_quantity_options(data: object) -> list[ConfigOption] | None | Unset:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            try:
                if not isinstance(data, list):
                    raise TypeError()
                quantity_options_type_0 = []
                _quantity_options_type_0 = data
                for quantity_options_type_0_item_data in _quantity_options_type_0:
                    quantity_options_type_0_item = ConfigOption.from_dict(quantity_options_type_0_item_data)

                    quantity_options_type_0.append(quantity_options_type_0_item)

                return quantity_options_type_0
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            return cast(list[ConfigOption] | None | Unset, data)

        quantity_options = _parse_quantity_options(d.pop("quantity_options", UNSET))

        def _parse_difficulty_options(data: object) -> list[ConfigOption] | None | Unset:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            try:
                if not isinstance(data, list):
                    raise TypeError()
                difficulty_options_type_0 = []
                _difficulty_options_type_0 = data
                for difficulty_options_type_0_item_data in _difficulty_options_type_0:
                    difficulty_options_type_0_item = ConfigOption.from_dict(difficulty_options_type_0_item_data)

                    difficulty_options_type_0.append(difficulty_options_type_0_item)

                return difficulty_options_type_0
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            return cast(list[ConfigOption] | None | Unset, data)

        difficulty_options = _parse_difficulty_options(d.pop("difficulty_options", UNSET))

        def _parse_topic_placeholder(data: object) -> None | str | Unset:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            return cast(None | str | Unset, data)

        topic_placeholder = _parse_topic_placeholder(d.pop("topic_placeholder", UNSET))

        supports_topic = d.pop("supports_topic", UNSET)

        tool_config_response = cls(
            tool_id=tool_id,
            tool_label=tool_label,
            quantity_options=quantity_options,
            difficulty_options=difficulty_options,
            topic_placeholder=topic_placeholder,
            supports_topic=supports_topic,
        )

        tool_config_response.additional_properties = d
        return tool_config_response

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
