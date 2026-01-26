from __future__ import annotations

import dataclasses
from typing import Any

from cl_stdx.enumx import MetaInfoStrEnum, XMetaInfo


@dataclasses.dataclass(frozen=True, slots=True)
class OutputTypeMeta(XMetaInfo):
    """Extended metadata for OutputType with tool-specific information."""

    tone: str = "slate"
    prompt: str = ""
    is_tool: bool = False  # Whether this output type is exposed as a workspace tool


class OutputType(MetaInfoStrEnum):
    """Output types for content generation.

    Each type has associated metadata including:
    - description: Brief description of the output type
    - display_text: User-facing label (Chinese)
    - tone: Color tone for UI (slate, blue, green, rose, amber, teal, indigo)
    - prompt: Default prompt for generation
    - is_tool: Whether exposed as a workspace tool
    """

    FAQ = "FAQ", OutputTypeMeta(
        description="问答清单",
        display_text="闪卡",
        tone="blue",
        prompt="整理为 FAQ 问答清单。",
        is_tool=True,
    )
    GUIDE = "GUIDE", OutputTypeMeta(
        description="学习/行动指南",
        display_text="指南",
        tone="green",
        prompt="生成结构化学习指南。",
        is_tool=True,
    )
    TIMELINE = "TIMELINE", OutputTypeMeta(
        description="关键事件序列",
        display_text="时间轴",
        tone="rose",
        prompt="按时间轴整理关键事件。",
        is_tool=True,
    )
    MINDMAP = "MINDMAP", OutputTypeMeta(
        description="主题层级结构",
        display_text="思维导图",
        tone="indigo",
        prompt="生成思维导图层级结构。",
        is_tool=True,
    )
    QUIZ = "QUIZ", OutputTypeMeta(
        description="知识检验",
        display_text="测验",
        tone="teal",
        prompt="生成小测验题目。",
        is_tool=True,
    )
    BRIEFING = "BRIEFING", OutputTypeMeta(
        description="高层摘要",
        display_text="报告",
        tone="amber",
        prompt="生成简报：背景/发现/建议/下一步。",
        is_tool=True,
    )
    SLIDES = "SLIDES", OutputTypeMeta(
        description="演示文稿",
        display_text="演示",
        tone="slate",
        prompt="生成演示大纲与 Slidev Markdown。",
        is_tool=True,
    )
    # Internal output types (not exposed as tools)
    PARAGRAPH = "PARAGRAPH", OutputTypeMeta(
        description="段落摘要",
        display_text="段落",
        prompt="Summarize the sources as a paragraph.",
    )
    BULLETS = "BULLETS", OutputTypeMeta(
        description="要点列表",
        display_text="要点",
        prompt="Summarize the sources as bullet points.",
    )
    STRUCTURED = "STRUCTURED", OutputTypeMeta(
        description="结构化摘要",
        display_text="结构化",
        prompt="Create a structured summary from the sources.",
    )

    @classmethod
    def get_tool_types(cls) -> list["OutputType"]:
        """Return output types that are exposed as workspace tools."""
        return [t for t in cls if t.x_meta.is_tool]  # pyright: ignore[reportAttributeAccessIssue]


OutputContent = dict[str, Any]
