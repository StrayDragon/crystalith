from __future__ import annotations

from collections.abc import Mapping
from typing import TYPE_CHECKING, Any, TypeVar, cast

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

if TYPE_CHECKING:
    from ..models.slide_generation_config import SlideGenerationConfig


T = TypeVar("T", bound="SlideDraftUpdate")


@_attrs_define
class SlideDraftUpdate:
    """
    Attributes:
        title (None | str | Unset):
        prompt (None | str | Unset):
        engine (None | str | Unset):
        chunk_ids (list[int] | None | Unset):
        generation_config (None | SlideGenerationConfig | Unset):
    """

    title: None | str | Unset = UNSET
    prompt: None | str | Unset = UNSET
    engine: None | str | Unset = UNSET
    chunk_ids: list[int] | None | Unset = UNSET
    generation_config: None | SlideGenerationConfig | Unset = UNSET
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)

    def to_dict(self) -> dict[str, Any]:
        from ..models.slide_generation_config import SlideGenerationConfig

        title: None | str | Unset
        if isinstance(self.title, Unset):
            title = UNSET
        else:
            title = self.title

        prompt: None | str | Unset
        if isinstance(self.prompt, Unset):
            prompt = UNSET
        else:
            prompt = self.prompt

        engine: None | str | Unset
        if isinstance(self.engine, Unset):
            engine = UNSET
        else:
            engine = self.engine

        chunk_ids: list[int] | None | Unset
        if isinstance(self.chunk_ids, Unset):
            chunk_ids = UNSET
        elif isinstance(self.chunk_ids, list):
            chunk_ids = self.chunk_ids

        else:
            chunk_ids = self.chunk_ids

        generation_config: dict[str, Any] | None | Unset
        if isinstance(self.generation_config, Unset):
            generation_config = UNSET
        elif isinstance(self.generation_config, SlideGenerationConfig):
            generation_config = self.generation_config.to_dict()
        else:
            generation_config = self.generation_config

        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({})
        if title is not UNSET:
            field_dict["title"] = title
        if prompt is not UNSET:
            field_dict["prompt"] = prompt
        if engine is not UNSET:
            field_dict["engine"] = engine
        if chunk_ids is not UNSET:
            field_dict["chunk_ids"] = chunk_ids
        if generation_config is not UNSET:
            field_dict["generation_config"] = generation_config

        return field_dict

    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.slide_generation_config import SlideGenerationConfig

        d = dict(src_dict)

        def _parse_title(data: object) -> None | str | Unset:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            return cast(None | str | Unset, data)

        title = _parse_title(d.pop("title", UNSET))

        def _parse_prompt(data: object) -> None | str | Unset:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            return cast(None | str | Unset, data)

        prompt = _parse_prompt(d.pop("prompt", UNSET))

        def _parse_engine(data: object) -> None | str | Unset:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            return cast(None | str | Unset, data)

        engine = _parse_engine(d.pop("engine", UNSET))

        def _parse_chunk_ids(data: object) -> list[int] | None | Unset:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            try:
                if not isinstance(data, list):
                    raise TypeError()
                chunk_ids_type_0 = cast(list[int], data)

                return chunk_ids_type_0
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            return cast(list[int] | None | Unset, data)

        chunk_ids = _parse_chunk_ids(d.pop("chunk_ids", UNSET))

        def _parse_generation_config(data: object) -> None | SlideGenerationConfig | Unset:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            try:
                if not isinstance(data, dict):
                    raise TypeError()
                generation_config_type_0 = SlideGenerationConfig.from_dict(data)

                return generation_config_type_0
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            return cast(None | SlideGenerationConfig | Unset, data)

        generation_config = _parse_generation_config(d.pop("generation_config", UNSET))

        slide_draft_update = cls(
            title=title,
            prompt=prompt,
            engine=engine,
            chunk_ids=chunk_ids,
            generation_config=generation_config,
        )

        slide_draft_update.additional_properties = d
        return slide_draft_update

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
