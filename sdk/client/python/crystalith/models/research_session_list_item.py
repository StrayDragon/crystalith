from __future__ import annotations

import datetime
from collections.abc import Mapping
from typing import Any, TypeVar

from attrs import define as _attrs_define
from attrs import field as _attrs_field
from dateutil.parser import isoparse

from ..models.research_session_list_item_research_status import ResearchSessionListItemResearchStatus
from ..types import UNSET, Unset

T = TypeVar("T", bound="ResearchSessionListItem")


@_attrs_define
class ResearchSessionListItem:
    """Simplified response for listing research sessions.

    Attributes:
        id (int):
        notebook_id (int):
        topic (str):
        status (ResearchSessionListItemResearchStatus): 枚举值:

            * `planning`: 正在规划搜索
            * `searching`: 正在执行搜索
            * `analyzing`: 正在分析结果
            * `waiting_user`: 等待用户确认
            * `completed`: 研究完成
            * `cancelled`: 已取消
        current_iteration (int):
        max_iterations (int):
        created_at (datetime.datetime):
        updated_at (datetime.datetime):
        result_count (int | Unset): Number of aggregated results Default: 0.
    """

    id: int
    notebook_id: int
    topic: str
    status: ResearchSessionListItemResearchStatus
    current_iteration: int
    max_iterations: int
    created_at: datetime.datetime
    updated_at: datetime.datetime
    result_count: int | Unset = 0
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)

    def to_dict(self) -> dict[str, Any]:
        id = self.id

        notebook_id = self.notebook_id

        topic = self.topic

        status = self.status.value

        current_iteration = self.current_iteration

        max_iterations = self.max_iterations

        created_at = self.created_at.isoformat()

        updated_at = self.updated_at.isoformat()

        result_count = self.result_count

        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update(
            {
                "id": id,
                "notebook_id": notebook_id,
                "topic": topic,
                "status": status,
                "current_iteration": current_iteration,
                "max_iterations": max_iterations,
                "created_at": created_at,
                "updated_at": updated_at,
            }
        )
        if result_count is not UNSET:
            field_dict["result_count"] = result_count

        return field_dict

    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        id = d.pop("id")

        notebook_id = d.pop("notebook_id")

        topic = d.pop("topic")

        status = ResearchSessionListItemResearchStatus(d.pop("status"))

        current_iteration = d.pop("current_iteration")

        max_iterations = d.pop("max_iterations")

        created_at = isoparse(d.pop("created_at"))

        updated_at = isoparse(d.pop("updated_at"))

        result_count = d.pop("result_count", UNSET)

        research_session_list_item = cls(
            id=id,
            notebook_id=notebook_id,
            topic=topic,
            status=status,
            current_iteration=current_iteration,
            max_iterations=max_iterations,
            created_at=created_at,
            updated_at=updated_at,
            result_count=result_count,
        )

        research_session_list_item.additional_properties = d
        return research_session_list_item

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
