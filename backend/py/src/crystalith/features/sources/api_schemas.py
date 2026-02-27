from __future__ import annotations

import datetime
from typing import Literal

from cl_stdx.enumx import MetaInfoStrEnum, XMetaInfo
from pydantic import BaseModel, ConfigDict, Field, field_validator

from crystalith.shared.json_types import JsonDict
from crystalith.shared.types import SourceStatus


class SourceRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    notebook_id: int
    filename: str
    mime_type: str | None
    parser_type: str
    metadata: JsonDict | None = Field(
        default=None,
        validation_alias="metadata_",
        serialization_alias="metadata",
    )
    status: SourceStatus
    error_code: str | None = None
    error_message: str | None
    recovery_hint: str | None = None
    last_error_at: datetime.datetime | None = None
    chunk_count: int = 0
    tags: list[str] = Field(default_factory=list)
    created_at: datetime.datetime
    updated_at: datetime.datetime


class ChunkRead(BaseModel):
    """Response model for a text chunk."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    chunk_index: int
    text: str
    start_offset: int | None
    end_offset: int | None
    metadata: JsonDict | None = Field(
        default=None,
        validation_alias="metadata_",
        serialization_alias="metadata",
    )


class SourceSearchStatus(MetaInfoStrEnum):
    """Status of a source search operation."""

    OK = "ok", XMetaInfo(description="搜索成功", display_text="成功")
    NOT_IMPLEMENTED = "not_implemented", XMetaInfo(description="功能未实现", display_text="未实现")


SourceSearchStatus.__module__ = "crystalith.features.sources.api"


class SourceSearchRequest(BaseModel):
    query: str = Field(..., min_length=1)
    engine: str = Field("Web")
    mode: str = Field("Fast Research")

    @field_validator("query")
    @classmethod
    def _strip_query(cls, value: str) -> str:
        trimmed = " ".join(value.strip().split())
        if not trimmed:
            raise ValueError("query must not be empty")
        return trimmed

    @field_validator("engine", "mode")
    @classmethod
    def _strip_label(cls, value: str) -> str:
        return value.strip() or value


class SourceSearchResult(BaseModel):
    title: str
    url: str
    snippet: str | None = None
    source: str | None = None


class SourceSearchResponse(BaseModel):
    status: SourceSearchStatus
    query: str
    engine: str
    mode: str
    results: list[SourceSearchResult]
    message: str | None = None
    created_at: datetime.datetime


class SourceBatchDeleteRequest(BaseModel):
    source_ids: list[int] = Field(..., min_length=1)


class SourceBatchItemResult(BaseModel):
    source_id: int
    ok: bool
    error_code: str | None = None
    message: str | None = None


class SourceBatchDeleteResponse(BaseModel):
    results: list[SourceBatchItemResult] = Field(default_factory=list)
    deleted_ids: list[int]
    deleted_count: int


class SourceBatchReembedRequest(BaseModel):
    source_ids: list[int] = Field(..., min_length=1)


class SourceBatchReembedResponse(BaseModel):
    results: list[SourceBatchItemResult] = Field(default_factory=list)
    reembedded_ids: list[int]
    failed_ids: list[int]
    reembedded_count: int
    failed_count: int


class SourceTagRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    notebook_id: int
    name: str
    created_at: datetime.datetime
    updated_at: datetime.datetime


class SourceTagCreateRequest(BaseModel):
    name: str = Field(..., min_length=1, max_length=64)

    @field_validator("name")
    @classmethod
    def _normalize_name(cls, value: str) -> str:
        trimmed = " ".join(value.strip().split())
        if not trimmed:
            raise ValueError("tag name must not be empty")
        return trimmed


class SourceTagUpdateRequest(SourceTagCreateRequest):
    pass


class SourceTagSourceBindingRequest(BaseModel):
    source_ids: list[int] = Field(..., min_length=1)


class SourceTagSourceBindingResponse(BaseModel):
    tag_id: int
    source_ids: list[int]
    count: int
    results: list[SourceBatchItemResult] = Field(default_factory=list)


class SourceFromUrlMode(MetaInfoStrEnum):
    """Mode for creating source from URL."""

    FETCH = "fetch", XMetaInfo(description="获取完整内容", display_text="获取内容")
    LINK = "link", XMetaInfo(description="仅保存链接", display_text="保存链接")


SourceFromUrlMode.__module__ = "crystalith.features.sources.api"


class ExtractorTypeEnum(MetaInfoStrEnum):
    """Available extractor types for URL content extraction."""

    TRAFILATURA = "trafilatura", XMetaInfo(description="本地提取 (Trafilatura)", display_text="本地提取")
    JINA = "jina", XMetaInfo(description="Jina Reader API", display_text="Jina Reader")
    FIRECRAWL = "firecrawl", XMetaInfo(description="Firecrawl API", display_text="Firecrawl")
    BROWSERLESS = "browserless", XMetaInfo(description="浏览器渲染 (Browserless)", display_text="浏览器渲染")


ExtractorTypeEnum.__module__ = "crystalith.features.sources.api"


class ExtractorInfoResponse(BaseModel):
    """Information about an available extractor."""

    type: str
    enabled: bool
    available: bool
    display_name: str
    description: str
    priority: int
    requires_api_key: bool = False
    requires_service: bool = False


class ExtractorsListResponse(BaseModel):
    """Response for listing available extractors."""

    extractors: list[ExtractorInfoResponse]
    default_extractor: str | None = None
    fallback_enabled: bool = True


class SourceFromUrlRequest(BaseModel):
    url: str = Field(..., min_length=1)
    title: str | None = Field(None)
    snippet: str | None = Field(None)
    mode: SourceFromUrlMode = Field(SourceFromUrlMode.LINK)
    extractor: str | None = Field(
        None,
        description="指定使用的提取器类型 (trafilatura, firecrawl, browserless)。如果不指定，使用默认降级顺序。",
    )

    @field_validator("url")
    @classmethod
    def _validate_url(cls, value: str) -> str:
        trimmed = value.strip()
        if not trimmed:
            raise ValueError("url must not be empty")
        if not trimmed.startswith(("http://", "https://")):
            raise ValueError("url must start with http:// or https://")
        return trimmed

    @field_validator("extractor")
    @classmethod
    def _validate_extractor(cls, value: str | None) -> str | None:
        if value is None:
            return None
        valid_extractors = {"trafilatura", "jina", "firecrawl", "browserless"}
        if value.lower() not in valid_extractors:
            raise ValueError(f"extractor must be one of: {', '.join(sorted(valid_extractors))}")
        return value.lower()


class SourceSummaryResponse(BaseModel):
    """Response for source summary."""

    source_id: int
    summary: str
    key_points: list[str]
    topics: list[str]
    word_count: int
    generated_at: datetime.datetime


class SourceQARequest(BaseModel):
    """Request for source-specific QA."""

    question: str = Field(..., min_length=1)


class SourceQAResponse(BaseModel):
    """Response for source-specific QA."""

    source_id: int
    answer: str
    created_at: datetime.datetime


class QAMessage(BaseModel):
    """A single QA message."""

    role: Literal["user", "assistant"]
    content: str


class ConvertSourceQAToSourceRequest(BaseModel):
    """Request to convert source QA conversation to a new source."""

    messages: list[QAMessage] = Field(..., min_length=1)


class ConvertSourceQAToSourceResponse(BaseModel):
    """Response after converting source QA to a new source."""

    source_id: int
    filename: str
