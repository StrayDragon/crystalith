from __future__ import annotations

from typing import Annotated, Any, Literal

from pydantic import BaseModel, BeforeValidator, ConfigDict, Field, model_validator


def _normalize_citations(value: Any) -> list[int]:
    if value is None:
        return []

    def _push_int(items: list[int], item: Any) -> None:
        try:
            parsed = int(item)
        except (TypeError, ValueError):
            return
        if parsed <= 0 or parsed in items:
            return
        items.append(parsed)

    if isinstance(value, (int, float)):
        items: list[int] = []
        _push_int(items, value)
        return items

    if isinstance(value, str):
        items = []
        token = ""
        for ch in value:
            if ch.isdigit():
                token += ch
                continue
            if token:
                _push_int(items, token)
                token = ""
        if token:
            _push_int(items, token)
        return items

    if isinstance(value, list):
        items = []
        for item in value:
            _push_int(items, item)
        return items

    return []


CitationIndices = Annotated[list[int], BeforeValidator(_normalize_citations)]


class CitedText(BaseModel):
    model_config = ConfigDict(extra="ignore")

    text: str
    citations: CitationIndices = Field(default_factory=list)

    @model_validator(mode="before")
    @classmethod
    def _coerce_from_str(cls, value: Any) -> Any:
        if isinstance(value, str):
            return {"text": value, "citations": []}
        return value


class FAQItem(BaseModel):
    model_config = ConfigDict(extra="ignore")

    question: str
    answer: str
    citations: CitationIndices = Field(default_factory=list)


class FAQOutput(BaseModel):
    model_config = ConfigDict(extra="ignore")

    items: list[FAQItem]


class GuideModule(BaseModel):
    model_config = ConfigDict(extra="ignore")

    title: str
    objective: CitedText
    key_points: list[CitedText] = Field(default_factory=list)
    examples: list[CitedText] = Field(default_factory=list)
    exercises: list[CitedText] = Field(default_factory=list)


class GuideOutput(BaseModel):
    model_config = ConfigDict(extra="ignore")

    modules: list[GuideModule]


class TimelineEvent(BaseModel):
    model_config = ConfigDict(extra="ignore")

    date: str
    event: str
    description: str
    citations: CitationIndices = Field(default_factory=list)


class TimelineOutput(BaseModel):
    model_config = ConfigDict(extra="ignore")

    events: list[TimelineEvent]


class MindmapNode(BaseModel):
    model_config = ConfigDict(extra="ignore")

    label: str
    citations: CitationIndices = Field(default_factory=list)
    children: list["MindmapNode"] = Field(default_factory=list)


class MindmapOutput(BaseModel):
    model_config = ConfigDict(extra="ignore")

    root: MindmapNode


class QuizQuestion(BaseModel):
    model_config = ConfigDict(extra="ignore")

    type: Literal["multiple_choice", "true_false", "short_answer"]
    question: str
    options: list[str] = Field(default_factory=list)
    answer: str
    explanation: str
    citations: CitationIndices = Field(default_factory=list)


class QuizOutput(BaseModel):
    model_config = ConfigDict(extra="ignore")

    questions: list[QuizQuestion]


class BriefingSection(BaseModel):
    model_config = ConfigDict(extra="ignore")

    heading: str
    points: list[CitedText] = Field(default_factory=list)


class BriefingOutput(BaseModel):
    model_config = ConfigDict(extra="ignore")

    sections: list[BriefingSection]


class ParagraphOutput(BaseModel):
    model_config = ConfigDict(extra="ignore")

    text: str
    citations: CitationIndices = Field(default_factory=list)


class BulletsOutput(BaseModel):
    model_config = ConfigDict(extra="ignore")

    items: list[CitedText]


class StructuredOutput(BaseModel):
    model_config = ConfigDict(extra="ignore")

    title: str
    bullets: list[CitedText]
    terms: list[str] = Field(default_factory=list)
