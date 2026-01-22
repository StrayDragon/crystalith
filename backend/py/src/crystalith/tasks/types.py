from __future__ import annotations

from cl_stdx.enumx import MetaInfoStrEnum, XMetaInfo


class TaskType(MetaInfoStrEnum):
    """Types of background tasks."""

    REFINE = "refine", XMetaInfo(description="内容精炼任务", display_text="精炼")
    DOCUMENT_PARSE = "document_parse", XMetaInfo(description="文档解析任务", display_text="文档解析")


class TaskStatus(MetaInfoStrEnum):
    """Status of a background task."""

    PENDING = "pending", XMetaInfo(description="等待执行", display_text="等待中")
    RUNNING = "running", XMetaInfo(description="正在执行", display_text="执行中")
    COMPLETED = "completed", XMetaInfo(description="执行完成", display_text="已完成")
    FAILED = "failed", XMetaInfo(description="执行失败", display_text="失败")
    CANCELLED = "cancelled", XMetaInfo(description="已取消", display_text="已取消")
