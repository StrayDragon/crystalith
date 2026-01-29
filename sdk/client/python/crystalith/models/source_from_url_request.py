from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, cast

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..models.source_from_url_request_source_from_url_mode import SourceFromUrlRequestSourceFromUrlMode
from ..types import UNSET, Unset

T = TypeVar("T", bound="SourceFromUrlRequest")


@_attrs_define
class SourceFromUrlRequest:
    """
    Attributes:
        url (str):
        title (None | str | Unset):
        snippet (None | str | Unset):
        mode (SourceFromUrlRequestSourceFromUrlMode | Unset): 枚举值:

            * `fetch`: 获取完整内容
            * `link`: 仅保存链接 Default: SourceFromUrlRequestSourceFromUrlMode.LINK.
        extractor (None | str | Unset): 指定使用的提取器类型 (trafilatura, firecrawl, browserless)。如果不指定，使用默认降级顺序。
    """

    url: str
    title: None | str | Unset = UNSET
    snippet: None | str | Unset = UNSET
    mode: SourceFromUrlRequestSourceFromUrlMode | Unset = SourceFromUrlRequestSourceFromUrlMode.LINK
    extractor: None | str | Unset = UNSET
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)

    def to_dict(self) -> dict[str, Any]:
        url = self.url

        title: None | str | Unset
        if isinstance(self.title, Unset):
            title = UNSET
        else:
            title = self.title

        snippet: None | str | Unset
        if isinstance(self.snippet, Unset):
            snippet = UNSET
        else:
            snippet = self.snippet

        mode: str | Unset = UNSET
        if not isinstance(self.mode, Unset):
            mode = self.mode.value

        extractor: None | str | Unset
        if isinstance(self.extractor, Unset):
            extractor = UNSET
        else:
            extractor = self.extractor

        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update(
            {
                "url": url,
            }
        )
        if title is not UNSET:
            field_dict["title"] = title
        if snippet is not UNSET:
            field_dict["snippet"] = snippet
        if mode is not UNSET:
            field_dict["mode"] = mode
        if extractor is not UNSET:
            field_dict["extractor"] = extractor

        return field_dict

    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        url = d.pop("url")

        def _parse_title(data: object) -> None | str | Unset:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            return cast(None | str | Unset, data)

        title = _parse_title(d.pop("title", UNSET))

        def _parse_snippet(data: object) -> None | str | Unset:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            return cast(None | str | Unset, data)

        snippet = _parse_snippet(d.pop("snippet", UNSET))

        _mode = d.pop("mode", UNSET)
        mode: SourceFromUrlRequestSourceFromUrlMode | Unset
        if isinstance(_mode, Unset):
            mode = UNSET
        else:
            mode = SourceFromUrlRequestSourceFromUrlMode(_mode)

        def _parse_extractor(data: object) -> None | str | Unset:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            return cast(None | str | Unset, data)

        extractor = _parse_extractor(d.pop("extractor", UNSET))

        source_from_url_request = cls(
            url=url,
            title=title,
            snippet=snippet,
            mode=mode,
            extractor=extractor,
        )

        source_from_url_request.additional_properties = d
        return source_from_url_request

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
