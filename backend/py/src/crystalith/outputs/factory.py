from __future__ import annotations

from typing import Type

from crystalith.ai.interfaces import ChatProvider

from .generators import (
    BriefingGenerator,
    BulletsGenerator,
    FAQGenerator,
    GuideGenerator,
    MindmapGenerator,
    ParagraphGenerator,
    QuizGenerator,
    StructuredGenerator,
    TimelineGenerator,
)
from .interfaces import OutputGenerator
from .types import OutputType


GENERATOR_MAP: dict[OutputType, Type[OutputGenerator]] = {
    OutputType.FAQ: FAQGenerator,
    OutputType.GUIDE: GuideGenerator,
    OutputType.TIMELINE: TimelineGenerator,
    OutputType.MINDMAP: MindmapGenerator,
    OutputType.QUIZ: QuizGenerator,
    OutputType.BRIEFING: BriefingGenerator,
    OutputType.PARAGRAPH: ParagraphGenerator,
    OutputType.BULLETS: BulletsGenerator,
    OutputType.STRUCTURED: StructuredGenerator,
}


def create_output_generator(output_type: OutputType, chatter: ChatProvider) -> OutputGenerator:
    generator_cls = GENERATOR_MAP.get(output_type)
    if generator_cls is None:
        raise ValueError(f"Unsupported output type: {output_type}")
    return generator_cls(chatter)
