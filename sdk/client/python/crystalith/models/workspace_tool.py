from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, cast

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..models.workspace_tool_output_type import WorkspaceToolOutputType
from ..models.workspace_tool_tone import WorkspaceToolTone
from ..types import UNSET, Unset

T = TypeVar("T", bound="WorkspaceTool")


@_attrs_define
class WorkspaceTool:
    """
    Attributes:
        id (str):
        label (str):
        description (str):
        tone (WorkspaceToolTone):
        output_type (WorkspaceToolOutputType): 枚举值:

            * `FAQ`: 问答清单
            * `GUIDE`: 学习/行动指南
            * `TIMELINE`: 关键事件序列
            * `MINDMAP`: 主题层级结构
            * `QUIZ`: 知识检验
            * `BRIEFING`: 高层摘要
            * `SLIDES`: 演示文稿
            * `PARAGRAPH`: 段落摘要
            * `BULLETS`: 要点列表
            * `STRUCTURED`: 结构化摘要
        prompt (str):
        badge (None | str | Unset):
        enabled (bool | Unset):  Default: True.
    """

    id: str
    label: str
    description: str
    tone: WorkspaceToolTone
    output_type: WorkspaceToolOutputType
    prompt: str
    badge: None | str | Unset = UNSET
    enabled: bool | Unset = True
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)

    def to_dict(self) -> dict[str, Any]:
        id = self.id

        label = self.label

        description = self.description

        tone = self.tone.value

        output_type = self.output_type.value

        prompt = self.prompt

        badge: None | str | Unset
        if isinstance(self.badge, Unset):
            badge = UNSET
        else:
            badge = self.badge

        enabled = self.enabled

        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update(
            {
                "id": id,
                "label": label,
                "description": description,
                "tone": tone,
                "output_type": output_type,
                "prompt": prompt,
            }
        )
        if badge is not UNSET:
            field_dict["badge"] = badge
        if enabled is not UNSET:
            field_dict["enabled"] = enabled

        return field_dict

    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        id = d.pop("id")

        label = d.pop("label")

        description = d.pop("description")

        tone = WorkspaceToolTone(d.pop("tone"))

        output_type = WorkspaceToolOutputType(d.pop("output_type"))

        prompt = d.pop("prompt")

        def _parse_badge(data: object) -> None | str | Unset:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            return cast(None | str | Unset, data)

        badge = _parse_badge(d.pop("badge", UNSET))

        enabled = d.pop("enabled", UNSET)

        workspace_tool = cls(
            id=id,
            label=label,
            description=description,
            tone=tone,
            output_type=output_type,
            prompt=prompt,
            badge=badge,
            enabled=enabled,
        )

        workspace_tool.additional_properties = d
        return workspace_tool

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
