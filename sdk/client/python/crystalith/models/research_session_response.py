from __future__ import annotations

import datetime
from collections.abc import Mapping
from typing import TYPE_CHECKING, Any, TypeVar, cast

from attrs import define as _attrs_define
from attrs import field as _attrs_field
from dateutil.parser import isoparse

from ..models.research_session_response_research_status import ResearchSessionResponseResearchStatus
from ..types import UNSET, Unset

if TYPE_CHECKING:
    from ..models.research_session_response_aggregated_results_type_0_item import (
        ResearchSessionResponseAggregatedResultsType0Item,
    )
    from ..models.research_step_response import ResearchStepResponse


T = TypeVar("T", bound="ResearchSessionResponse")


@_attrs_define
class ResearchSessionResponse:
    """Response model for a research session.

    Attributes:
        id (int):
        notebook_id (int):
        topic (str):
        status (ResearchSessionResponseResearchStatus): 枚举值:

            * `planning`: 正在规划搜索
            * `searching`: 正在执行搜索
            * `analyzing`: 正在分析结果
            * `waiting_user`: 等待用户确认
            * `completed`: 研究完成
            * `cancelled`: 已取消
        current_iteration (int):
        max_iterations (int):
        aggregated_results (list[ResearchSessionResponseAggregatedResultsType0Item] | None):
        final_report (None | str):
        created_at (datetime.datetime):
        updated_at (datetime.datetime):
        steps (list[ResearchStepResponse] | Unset):
    """

    id: int
    notebook_id: int
    topic: str
    status: ResearchSessionResponseResearchStatus
    current_iteration: int
    max_iterations: int
    aggregated_results: list[ResearchSessionResponseAggregatedResultsType0Item] | None
    final_report: None | str
    created_at: datetime.datetime
    updated_at: datetime.datetime
    steps: list[ResearchStepResponse] | Unset = UNSET
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)

    def to_dict(self) -> dict[str, Any]:
        id = self.id

        notebook_id = self.notebook_id

        topic = self.topic

        status = self.status.value

        current_iteration = self.current_iteration

        max_iterations = self.max_iterations

        aggregated_results: list[dict[str, Any]] | None
        if isinstance(self.aggregated_results, list):
            aggregated_results = []
            for aggregated_results_type_0_item_data in self.aggregated_results:
                aggregated_results_type_0_item = aggregated_results_type_0_item_data.to_dict()
                aggregated_results.append(aggregated_results_type_0_item)

        else:
            aggregated_results = self.aggregated_results

        final_report: None | str
        final_report = self.final_report

        created_at = self.created_at.isoformat()

        updated_at = self.updated_at.isoformat()

        steps: list[dict[str, Any]] | Unset = UNSET
        if not isinstance(self.steps, Unset):
            steps = []
            for steps_item_data in self.steps:
                steps_item = steps_item_data.to_dict()
                steps.append(steps_item)

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
                "aggregated_results": aggregated_results,
                "final_report": final_report,
                "created_at": created_at,
                "updated_at": updated_at,
            }
        )
        if steps is not UNSET:
            field_dict["steps"] = steps

        return field_dict

    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.research_session_response_aggregated_results_type_0_item import (
            ResearchSessionResponseAggregatedResultsType0Item,
        )
        from ..models.research_step_response import ResearchStepResponse

        d = dict(src_dict)
        id = d.pop("id")

        notebook_id = d.pop("notebook_id")

        topic = d.pop("topic")

        status = ResearchSessionResponseResearchStatus(d.pop("status"))

        current_iteration = d.pop("current_iteration")

        max_iterations = d.pop("max_iterations")

        def _parse_aggregated_results(data: object) -> list[ResearchSessionResponseAggregatedResultsType0Item] | None:
            if data is None:
                return data
            try:
                if not isinstance(data, list):
                    raise TypeError()
                aggregated_results_type_0 = []
                _aggregated_results_type_0 = data
                for aggregated_results_type_0_item_data in _aggregated_results_type_0:
                    aggregated_results_type_0_item = ResearchSessionResponseAggregatedResultsType0Item.from_dict(
                        aggregated_results_type_0_item_data
                    )

                    aggregated_results_type_0.append(aggregated_results_type_0_item)

                return aggregated_results_type_0
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            return cast(list[ResearchSessionResponseAggregatedResultsType0Item] | None, data)

        aggregated_results = _parse_aggregated_results(d.pop("aggregated_results"))

        def _parse_final_report(data: object) -> None | str:
            if data is None:
                return data
            return cast(None | str, data)

        final_report = _parse_final_report(d.pop("final_report"))

        created_at = isoparse(d.pop("created_at"))

        updated_at = isoparse(d.pop("updated_at"))

        _steps = d.pop("steps", UNSET)
        steps: list[ResearchStepResponse] | Unset = UNSET
        if _steps is not UNSET:
            steps = []
            for steps_item_data in _steps:
                steps_item = ResearchStepResponse.from_dict(steps_item_data)

                steps.append(steps_item)

        research_session_response = cls(
            id=id,
            notebook_id=notebook_id,
            topic=topic,
            status=status,
            current_iteration=current_iteration,
            max_iterations=max_iterations,
            aggregated_results=aggregated_results,
            final_report=final_report,
            created_at=created_at,
            updated_at=updated_at,
            steps=steps,
        )

        research_session_response.additional_properties = d
        return research_session_response

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
