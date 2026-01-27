from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


class CitedText(BaseModel):
    model_config = ConfigDict(extra="forbid")

    text: str
    citations: list[int] = Field(default_factory=list)


class FAQItem(BaseModel):
    model_config = ConfigDict(extra="forbid")

    question: str
    answer: str
    citations: list[int] = Field(default_factory=list)


class FAQOutput(BaseModel):
    model_config = ConfigDict(extra="forbid")

    items: list[FAQItem]


class GuideModule(BaseModel):
    model_config = ConfigDict(extra="forbid")

    title: str
    objective: CitedText
    key_points: list[CitedText] = Field(default_factory=list)
    examples: list[CitedText] = Field(default_factory=list)
    exercises: list[CitedText] = Field(default_factory=list)


class GuideOutput(BaseModel):
    model_config = ConfigDict(extra="forbid")

    modules: list[GuideModule]


class TimelineEvent(BaseModel):
    model_config = ConfigDict(extra="forbid")

    date: str
    event: str
    description: str
    citations: list[int] = Field(default_factory=list)


class TimelineOutput(BaseModel):
    model_config = ConfigDict(extra="forbid")

    events: list[TimelineEvent]


class MindmapNode(BaseModel):
    model_config = ConfigDict(extra="forbid")

    label: str
    citations: list[int] = Field(default_factory=list)
    children: list["MindmapNode"] = Field(default_factory=list)


class MindmapOutput(BaseModel):
    model_config = ConfigDict(extra="forbid")

    root: MindmapNode


class QuizQuestion(BaseModel):
    model_config = ConfigDict(extra="forbid")

    type: Literal["multiple_choice", "true_false", "short_answer"]
    question: str
    options: list[str] = Field(default_factory=list)
    answer: str
    explanation: str
    citations: list[int] = Field(default_factory=list)


class QuizOutput(BaseModel):
    model_config = ConfigDict(extra="forbid")

    questions: list[QuizQuestion]


class BriefingSection(BaseModel):
    model_config = ConfigDict(extra="forbid")

    heading: str
    points: list[CitedText] = Field(default_factory=list)


class BriefingOutput(BaseModel):
    model_config = ConfigDict(extra="forbid")

    sections: list[BriefingSection]


class ParagraphOutput(BaseModel):
    model_config = ConfigDict(extra="forbid")

    text: str
    citations: list[int] = Field(default_factory=list)


class BulletsOutput(BaseModel):
    model_config = ConfigDict(extra="forbid")

    items: list[CitedText]


class StructuredOutput(BaseModel):
    model_config = ConfigDict(extra="forbid")

    title: str
    bullets: list[CitedText]
    terms: list[str] = Field(default_factory=list)
