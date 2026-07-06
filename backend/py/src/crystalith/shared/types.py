from __future__ import annotations

import dataclasses
from typing import cast

from lush_stdx.enumx import MetaInfoStrEnum, XMetaInfo


@dataclasses.dataclass(frozen=True, slots=True)
class OutputTypeMeta(XMetaInfo):
    tone: str = "slate"
    prompt: str = ""
    is_tool: bool = False


class OutputType(MetaInfoStrEnum):
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

    @property
    def meta(self) -> OutputTypeMeta:
        # `cl_stdx.enumx` attaches `x_meta` dynamically on enum members.
        return cast(OutputTypeMeta, self.x_meta)  # pyright: ignore[reportAttributeAccessIssue]

    @classmethod
    def get_tool_types(cls) -> list[OutputType]:
        return [t for t in cls if t.meta.is_tool]


class SourceStatus(MetaInfoStrEnum):
    PROCESSING = "processing", XMetaInfo(description="正在处理", display_text="处理中")
    READY = "ready", XMetaInfo(description="处理完成", display_text="就绪")
    FAILED = "failed", XMetaInfo(description="处理失败", display_text="失败")


class ResearchStatus(MetaInfoStrEnum):
    PLANNING = "planning", XMetaInfo(description="正在规划搜索", display_text="规划中")
    SEARCHING = "searching", XMetaInfo(description="正在执行搜索", display_text="搜索中")
    ANALYZING = "analyzing", XMetaInfo(description="正在分析结果", display_text="分析中")
    WAITING_USER = "waiting_user", XMetaInfo(description="等待用户确认", display_text="待确认")
    COMPLETED = "completed", XMetaInfo(description="研究完成", display_text="已完成")
    CANCELLED = "cancelled", XMetaInfo(description="已取消", display_text="已取消")


class ResearchStepType(MetaInfoStrEnum):
    PLAN = "plan", XMetaInfo(description="搜索计划", display_text="计划")
    SEARCH = "search", XMetaInfo(description="执行搜索", display_text="搜索")
    ANALYZE = "analyze", XMetaInfo(description="分析结果", display_text="分析")
    USER_INPUT = "user_input", XMetaInfo(description="用户输入", display_text="用户输入")
    SUMMARY = "summary", XMetaInfo(description="生成报告", display_text="报告")


class ResearchStepStatus(MetaInfoStrEnum):
    PENDING = "pending", XMetaInfo(description="等待执行", display_text="待执行")
    RUNNING = "running", XMetaInfo(description="正在执行", display_text="执行中")
    COMPLETED = "completed", XMetaInfo(description="执行完成", display_text="已完成")
    SKIPPED = "skipped", XMetaInfo(description="已跳过", display_text="已跳过")


class SlideStage(MetaInfoStrEnum):
    INPUT = "input", XMetaInfo(description="输入阶段", display_text="输入")
    OUTLINE = "outline", XMetaInfo(description="大纲阶段", display_text="大纲")
    MARKDOWN = "markdown", XMetaInfo(description="Markdown 阶段", display_text="Markdown")


class SlideStatus(MetaInfoStrEnum):
    IDLE = "idle", XMetaInfo(description="空闲", display_text="空闲")
    RUNNING = "running", XMetaInfo(description="生成中", display_text="生成中")
    ERROR = "error", XMetaInfo(description="失败", display_text="失败")


class TaskType(MetaInfoStrEnum):
    REFINE = "refine", XMetaInfo(description="内容精炼任务", display_text="精炼")
    DOCUMENT_PARSE = "document_parse", XMetaInfo(description="文档解析任务", display_text="文档解析")


class TaskStatus(MetaInfoStrEnum):
    PENDING = "pending", XMetaInfo(description="等待执行", display_text="等待中")
    RUNNING = "running", XMetaInfo(description="正在执行", display_text="执行中")
    COMPLETED = "completed", XMetaInfo(description="执行完成", display_text="已完成")
    FAILED = "failed", XMetaInfo(description="执行失败", display_text="失败")
    CANCELLED = "cancelled", XMetaInfo(description="已取消", display_text="已取消")
