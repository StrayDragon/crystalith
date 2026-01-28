from __future__ import annotations

import datetime
from collections.abc import Mapping
from typing import TYPE_CHECKING, Any, TypeVar, cast

from attrs import define as _attrs_define
from attrs import field as _attrs_field
from dateutil.parser import isoparse

from ..models.task_read_task_status import TaskReadTaskStatus
from ..models.task_read_task_type import TaskReadTaskType

if TYPE_CHECKING:
    from ..models.task_read_payload import TaskReadPayload
    from ..models.task_read_result_type_0 import TaskReadResultType0


T = TypeVar("T", bound="TaskRead")


@_attrs_define
class TaskRead:
    """
    Attributes:
        id (int):
        notebook_id (int | None):
        type_ (TaskReadTaskType): 枚举值:

            * `refine`: 内容精炼任务
            * `document_parse`: 文档解析任务
        status (TaskReadTaskStatus): 枚举值:

            * `pending`: 等待执行
            * `running`: 正在执行
            * `completed`: 执行完成
            * `failed`: 执行失败
            * `cancelled`: 已取消
        payload (TaskReadPayload):
        result (None | TaskReadResultType0):
        error (None | str):
        progress (int):
        created_at (datetime.datetime):
        updated_at (datetime.datetime):
    """

    id: int
    notebook_id: int | None
    type_: TaskReadTaskType
    status: TaskReadTaskStatus
    payload: TaskReadPayload
    result: None | TaskReadResultType0
    error: None | str
    progress: int
    created_at: datetime.datetime
    updated_at: datetime.datetime
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)

    def to_dict(self) -> dict[str, Any]:
        from ..models.task_read_result_type_0 import TaskReadResultType0

        id = self.id

        notebook_id: int | None
        notebook_id = self.notebook_id

        type_ = self.type_.value

        status = self.status.value

        payload = self.payload.to_dict()

        result: dict[str, Any] | None
        if isinstance(self.result, TaskReadResultType0):
            result = self.result.to_dict()
        else:
            result = self.result

        error: None | str
        error = self.error

        progress = self.progress

        created_at = self.created_at.isoformat()

        updated_at = self.updated_at.isoformat()

        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update(
            {
                "id": id,
                "notebook_id": notebook_id,
                "type": type_,
                "status": status,
                "payload": payload,
                "result": result,
                "error": error,
                "progress": progress,
                "created_at": created_at,
                "updated_at": updated_at,
            }
        )

        return field_dict

    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.task_read_payload import TaskReadPayload
        from ..models.task_read_result_type_0 import TaskReadResultType0

        d = dict(src_dict)
        id = d.pop("id")

        def _parse_notebook_id(data: object) -> int | None:
            if data is None:
                return data
            return cast(int | None, data)

        notebook_id = _parse_notebook_id(d.pop("notebook_id"))

        type_ = TaskReadTaskType(d.pop("type"))

        status = TaskReadTaskStatus(d.pop("status"))

        payload = TaskReadPayload.from_dict(d.pop("payload"))

        def _parse_result(data: object) -> None | TaskReadResultType0:
            if data is None:
                return data
            try:
                if not isinstance(data, dict):
                    raise TypeError()
                result_type_0 = TaskReadResultType0.from_dict(data)

                return result_type_0
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            return cast(None | TaskReadResultType0, data)

        result = _parse_result(d.pop("result"))

        def _parse_error(data: object) -> None | str:
            if data is None:
                return data
            return cast(None | str, data)

        error = _parse_error(d.pop("error"))

        progress = d.pop("progress")

        created_at = isoparse(d.pop("created_at"))

        updated_at = isoparse(d.pop("updated_at"))

        task_read = cls(
            id=id,
            notebook_id=notebook_id,
            type_=type_,
            status=status,
            payload=payload,
            result=result,
            error=error,
            progress=progress,
            created_at=created_at,
            updated_at=updated_at,
        )

        task_read.additional_properties = d
        return task_read

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
