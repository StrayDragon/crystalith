from __future__ import annotations

import datetime
from collections.abc import Mapping
from typing import TYPE_CHECKING, Any, TypeVar, cast

from attrs import define as _attrs_define
from attrs import field as _attrs_field
from dateutil.parser import isoparse

from ..models.slide_draft_read_slide_stage import SlideDraftReadSlideStage
from ..models.slide_draft_read_slide_status import SlideDraftReadSlideStatus

if TYPE_CHECKING:
    from ..models.slide_generation_config import SlideGenerationConfig
    from ..models.slide_outline import SlideOutline


T = TypeVar("T", bound="SlideDraftRead")


@_attrs_define
class SlideDraftRead:
    """
    Attributes:
        id (int):
        notebook_id (int):
        output_id (int | None):
        title (None | str):
        prompt (None | str):
        engine (str):
        chunk_ids (list[int] | None):
        outline (None | SlideOutline):
        markdown (None | str):
        generation_config (None | SlideGenerationConfig):
        stage (SlideDraftReadSlideStage): 枚举值:

            * `input`: 输入阶段
            * `outline`: 大纲阶段
            * `markdown`: Markdown 阶段
        status (SlideDraftReadSlideStatus): 枚举值:

            * `idle`: 空闲
            * `running`: 生成中
            * `error`: 失败
        error_message (None | str):
        created_at (datetime.datetime):
        updated_at (datetime.datetime):
    """

    id: int
    notebook_id: int
    output_id: int | None
    title: None | str
    prompt: None | str
    engine: str
    chunk_ids: list[int] | None
    outline: None | SlideOutline
    markdown: None | str
    generation_config: None | SlideGenerationConfig
    stage: SlideDraftReadSlideStage
    status: SlideDraftReadSlideStatus
    error_message: None | str
    created_at: datetime.datetime
    updated_at: datetime.datetime
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)

    def to_dict(self) -> dict[str, Any]:
        from ..models.slide_generation_config import SlideGenerationConfig
        from ..models.slide_outline import SlideOutline

        id = self.id

        notebook_id = self.notebook_id

        output_id: int | None
        output_id = self.output_id

        title: None | str
        title = self.title

        prompt: None | str
        prompt = self.prompt

        engine = self.engine

        chunk_ids: list[int] | None
        if isinstance(self.chunk_ids, list):
            chunk_ids = self.chunk_ids

        else:
            chunk_ids = self.chunk_ids

        outline: dict[str, Any] | None
        if isinstance(self.outline, SlideOutline):
            outline = self.outline.to_dict()
        else:
            outline = self.outline

        markdown: None | str
        markdown = self.markdown

        generation_config: dict[str, Any] | None
        if isinstance(self.generation_config, SlideGenerationConfig):
            generation_config = self.generation_config.to_dict()
        else:
            generation_config = self.generation_config

        stage = self.stage.value

        status = self.status.value

        error_message: None | str
        error_message = self.error_message

        created_at = self.created_at.isoformat()

        updated_at = self.updated_at.isoformat()

        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update(
            {
                "id": id,
                "notebook_id": notebook_id,
                "output_id": output_id,
                "title": title,
                "prompt": prompt,
                "engine": engine,
                "chunk_ids": chunk_ids,
                "outline": outline,
                "markdown": markdown,
                "generation_config": generation_config,
                "stage": stage,
                "status": status,
                "error_message": error_message,
                "created_at": created_at,
                "updated_at": updated_at,
            }
        )

        return field_dict

    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.slide_generation_config import SlideGenerationConfig
        from ..models.slide_outline import SlideOutline

        d = dict(src_dict)
        id = d.pop("id")

        notebook_id = d.pop("notebook_id")

        def _parse_output_id(data: object) -> int | None:
            if data is None:
                return data
            return cast(int | None, data)

        output_id = _parse_output_id(d.pop("output_id"))

        def _parse_title(data: object) -> None | str:
            if data is None:
                return data
            return cast(None | str, data)

        title = _parse_title(d.pop("title"))

        def _parse_prompt(data: object) -> None | str:
            if data is None:
                return data
            return cast(None | str, data)

        prompt = _parse_prompt(d.pop("prompt"))

        engine = d.pop("engine")

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

        def _parse_outline(data: object) -> None | SlideOutline:
            if data is None:
                return data
            try:
                if not isinstance(data, dict):
                    raise TypeError()
                outline_type_0 = SlideOutline.from_dict(data)

                return outline_type_0
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            return cast(None | SlideOutline, data)

        outline = _parse_outline(d.pop("outline"))

        def _parse_markdown(data: object) -> None | str:
            if data is None:
                return data
            return cast(None | str, data)

        markdown = _parse_markdown(d.pop("markdown"))

        def _parse_generation_config(data: object) -> None | SlideGenerationConfig:
            if data is None:
                return data
            try:
                if not isinstance(data, dict):
                    raise TypeError()
                generation_config_type_0 = SlideGenerationConfig.from_dict(data)

                return generation_config_type_0
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            return cast(None | SlideGenerationConfig, data)

        generation_config = _parse_generation_config(d.pop("generation_config"))

        stage = SlideDraftReadSlideStage(d.pop("stage"))

        status = SlideDraftReadSlideStatus(d.pop("status"))

        def _parse_error_message(data: object) -> None | str:
            if data is None:
                return data
            return cast(None | str, data)

        error_message = _parse_error_message(d.pop("error_message"))

        created_at = isoparse(d.pop("created_at"))

        updated_at = isoparse(d.pop("updated_at"))

        slide_draft_read = cls(
            id=id,
            notebook_id=notebook_id,
            output_id=output_id,
            title=title,
            prompt=prompt,
            engine=engine,
            chunk_ids=chunk_ids,
            outline=outline,
            markdown=markdown,
            generation_config=generation_config,
            stage=stage,
            status=status,
            error_message=error_message,
            created_at=created_at,
            updated_at=updated_at,
        )

        slide_draft_read.additional_properties = d
        return slide_draft_read

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
