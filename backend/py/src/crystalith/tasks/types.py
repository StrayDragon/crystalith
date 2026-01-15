from __future__ import annotations

from enum import StrEnum


class TaskType(StrEnum):
    REFINE = "refine"
    DOCUMENT_PARSE = "document_parse"
    AUDIO_OVERVIEW = "audio_overview"
    VIDEO_OVERVIEW = "video_overview"


class TaskStatus(StrEnum):
    PENDING = "pending"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"
