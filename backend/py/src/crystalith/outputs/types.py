from __future__ import annotations

from enum import StrEnum
from typing import Any


class OutputType(StrEnum):
    FAQ = "FAQ"
    GUIDE = "GUIDE"
    TIMELINE = "TIMELINE"
    MINDMAP = "MINDMAP"
    QUIZ = "QUIZ"
    BRIEFING = "BRIEFING"
    PARAGRAPH = "PARAGRAPH"
    BULLETS = "BULLETS"
    STRUCTURED = "STRUCTURED"


OutputContent = dict[str, Any]
