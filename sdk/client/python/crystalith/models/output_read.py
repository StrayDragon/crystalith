from __future__ import annotations

import datetime
from collections.abc import Mapping
from typing import TYPE_CHECKING, Any, TypeVar, cast

from attrs import define as _attrs_define
from attrs import field as _attrs_field
from dateutil.parser import isoparse

from ..models.output_read_output_type import OutputReadOutputType

if TYPE_CHECKING:
    from ..models.output_read_content import OutputReadContent


T = TypeVar("T", bound="OutputRead")


@_attrs_define
class OutputRead:
    """
    Attributes:
        id (int):
        notebook_id (int):
        type_ (OutputReadOutputType): 枚举值:

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
        prompt (None | str):
        chunk_ids (list[int] | None):
        content (OutputReadContent):
        created_at (datetime.datetime):
        updated_at (datetime.datetime):
    """

    id: int
    notebook_id: int
    type_: OutputReadOutputType
    prompt: None | str
    chunk_ids: list[int] | None
    content: OutputReadContent
    created_at: datetime.datetime
    updated_at: datetime.datetime
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)

    def to_dict(self) -> dict[str, Any]:
        id = self.id

        notebook_id = self.notebook_id

        type_ = self.type_.value

        prompt: None | str
        prompt = self.prompt

        chunk_ids: list[int] | None
        if isinstance(self.chunk_ids, list):
            chunk_ids = self.chunk_ids

        else:
            chunk_ids = self.chunk_ids

        content = self.content.to_dict()

        created_at = self.created_at.isoformat()

        updated_at = self.updated_at.isoformat()

        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update(
            {
                "id": id,
                "notebook_id": notebook_id,
                "type": type_,
                "prompt": prompt,
                "chunk_ids": chunk_ids,
                "content": content,
                "created_at": created_at,
                "updated_at": updated_at,
            }
        )

        return field_dict

    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.output_read_content import OutputReadContent

        d = dict(src_dict)
        id = d.pop("id")

        notebook_id = d.pop("notebook_id")

        type_ = OutputReadOutputType(d.pop("type"))

        def _parse_prompt(data: object) -> None | str:
            if data is None:
                return data
            return cast(None | str, data)

        prompt = _parse_prompt(d.pop("prompt"))

        def _parse_chunk_ids(data: object) -> list[int] | None:
            if data is None:
                return data
            try:
                if not isinstance(data, list):
                    raise TypeError()
                chunk_ids_type_0 = cast(list[int], data)

                return chunk_ids_type_0
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            return cast(list[int] | None, data)

        chunk_ids = _parse_chunk_ids(d.pop("chunk_ids"))

        content = OutputReadContent.from_dict(d.pop("content"))

        created_at = isoparse(d.pop("created_at"))

        updated_at = isoparse(d.pop("updated_at"))

        output_read = cls(
            id=id,
            notebook_id=notebook_id,
            type_=type_,
            prompt=prompt,
            chunk_ids=chunk_ids,
            content=content,
            created_at=created_at,
            updated_at=updated_at,
        )

        output_read.additional_properties = d
        return output_read

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
