from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, cast

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..models.convert_session_to_output_request_output_type import ConvertSessionToOutputRequestOutputType
from ..types import UNSET, Unset

T = TypeVar("T", bound="ConvertSessionToOutputRequest")


@_attrs_define
class ConvertSessionToOutputRequest:
    """Request to convert session messages to an output.

    Attributes:
        message_ids (list[int] | None | Unset): Specific message IDs to convert. If null, converts entire session.
        output_type (ConvertSessionToOutputRequestOutputType | Unset): Type of output to create.

            * `FAQ`: 问答清单
            * `GUIDE`: 学习/行动指南
            * `TIMELINE`: 关键事件序列
            * `MINDMAP`: 主题层级结构
            * `QUIZ`: 知识检验
            * `BRIEFING`: 高层摘要
            * `SLIDES`: 演示文稿
            * `PARAGRAPH`: 段落摘要
            * `BULLETS`: 要点列表
            * `STRUCTURED`: 结构化摘要 Default: ConvertSessionToOutputRequestOutputType.PARAGRAPH.
    """

    message_ids: list[int] | None | Unset = UNSET
    output_type: ConvertSessionToOutputRequestOutputType | Unset = ConvertSessionToOutputRequestOutputType.PARAGRAPH
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)

    def to_dict(self) -> dict[str, Any]:
        message_ids: list[int] | None | Unset
        if isinstance(self.message_ids, Unset):
            message_ids = UNSET
        elif isinstance(self.message_ids, list):
            message_ids = self.message_ids

        else:
            message_ids = self.message_ids

        output_type: str | Unset = UNSET
        if not isinstance(self.output_type, Unset):
            output_type = self.output_type.value

        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({})
        if message_ids is not UNSET:
            field_dict["message_ids"] = message_ids
        if output_type is not UNSET:
            field_dict["output_type"] = output_type

        return field_dict

    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)

        def _parse_message_ids(data: object) -> list[int] | None | Unset:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            try:
                if not isinstance(data, list):
                    raise TypeError()
                message_ids_type_0 = cast(list[int], data)

                return message_ids_type_0
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            return cast(list[int] | None | Unset, data)

        message_ids = _parse_message_ids(d.pop("message_ids", UNSET))

        _output_type = d.pop("output_type", UNSET)
        output_type: ConvertSessionToOutputRequestOutputType | Unset
        if isinstance(_output_type, Unset):
            output_type = UNSET
        else:
            output_type = ConvertSessionToOutputRequestOutputType(_output_type)

        convert_session_to_output_request = cls(
            message_ids=message_ids,
            output_type=output_type,
        )

        convert_session_to_output_request.additional_properties = d
        return convert_session_to_output_request

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
