from __future__ import annotations

import datetime
from collections.abc import Mapping
from typing import TYPE_CHECKING, Any, TypeVar, cast

from attrs import define as _attrs_define
from attrs import field as _attrs_field
from dateutil.parser import isoparse

from ..models.research_step_response_research_step_status import ResearchStepResponseResearchStepStatus
from ..models.research_step_response_research_step_type import ResearchStepResponseResearchStepType

if TYPE_CHECKING:
    from ..models.research_step_response_input_data_type_0 import ResearchStepResponseInputDataType0
    from ..models.research_step_response_output_data_type_0 import ResearchStepResponseOutputDataType0


T = TypeVar("T", bound="ResearchStepResponse")


@_attrs_define
class ResearchStepResponse:
    """Response model for a research step.

    Attributes:
        id (int):
        session_id (int):
        iteration (int):
        type_ (ResearchStepResponseResearchStepType): 枚举值:

            * `plan`: 搜索计划
            * `search`: 执行搜索
            * `analyze`: 分析结果
            * `user_input`: 用户输入
            * `summary`: 生成报告
        input_data (None | ResearchStepResponseInputDataType0):
        output_data (None | ResearchStepResponseOutputDataType0):
        status (ResearchStepResponseResearchStepStatus): 枚举值:

            * `pending`: 等待执行
            * `running`: 正在执行
            * `completed`: 执行完成
            * `skipped`: 已跳过
        created_at (datetime.datetime):
    """

    id: int
    session_id: int
    iteration: int
    type_: ResearchStepResponseResearchStepType
    input_data: None | ResearchStepResponseInputDataType0
    output_data: None | ResearchStepResponseOutputDataType0
    status: ResearchStepResponseResearchStepStatus
    created_at: datetime.datetime
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)

    def to_dict(self) -> dict[str, Any]:
        from ..models.research_step_response_input_data_type_0 import ResearchStepResponseInputDataType0
        from ..models.research_step_response_output_data_type_0 import ResearchStepResponseOutputDataType0

        id = self.id

        session_id = self.session_id

        iteration = self.iteration

        type_ = self.type_.value

        input_data: dict[str, Any] | None
        if isinstance(self.input_data, ResearchStepResponseInputDataType0):
            input_data = self.input_data.to_dict()
        else:
            input_data = self.input_data

        output_data: dict[str, Any] | None
        if isinstance(self.output_data, ResearchStepResponseOutputDataType0):
            output_data = self.output_data.to_dict()
        else:
            output_data = self.output_data

        status = self.status.value

        created_at = self.created_at.isoformat()

        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update(
            {
                "id": id,
                "session_id": session_id,
                "iteration": iteration,
                "type": type_,
                "input_data": input_data,
                "output_data": output_data,
                "status": status,
                "created_at": created_at,
            }
        )

        return field_dict

    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.research_step_response_input_data_type_0 import ResearchStepResponseInputDataType0
        from ..models.research_step_response_output_data_type_0 import ResearchStepResponseOutputDataType0

        d = dict(src_dict)
        id = d.pop("id")

        session_id = d.pop("session_id")

        iteration = d.pop("iteration")

        type_ = ResearchStepResponseResearchStepType(d.pop("type"))

        def _parse_input_data(data: object) -> None | ResearchStepResponseInputDataType0:
            if data is None:
                return data
            try:
                if not isinstance(data, dict):
                    raise TypeError()
                input_data_type_0 = ResearchStepResponseInputDataType0.from_dict(data)

                return input_data_type_0
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            return cast(None | ResearchStepResponseInputDataType0, data)

        input_data = _parse_input_data(d.pop("input_data"))

        def _parse_output_data(data: object) -> None | ResearchStepResponseOutputDataType0:
            if data is None:
                return data
            try:
                if not isinstance(data, dict):
                    raise TypeError()
                output_data_type_0 = ResearchStepResponseOutputDataType0.from_dict(data)

                return output_data_type_0
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            return cast(None | ResearchStepResponseOutputDataType0, data)

        output_data = _parse_output_data(d.pop("output_data"))

        status = ResearchStepResponseResearchStepStatus(d.pop("status"))

        created_at = isoparse(d.pop("created_at"))

        research_step_response = cls(
            id=id,
            session_id=session_id,
            iteration=iteration,
            type_=type_,
            input_data=input_data,
            output_data=output_data,
            status=status,
            created_at=created_at,
        )

        research_step_response.additional_properties = d
        return research_step_response

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
