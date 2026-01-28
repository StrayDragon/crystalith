from enum import Enum


class OutputReadOutputType(str, Enum):
    BRIEFING = "BRIEFING"
    BULLETS = "BULLETS"
    FAQ = "FAQ"
    GUIDE = "GUIDE"
    MINDMAP = "MINDMAP"
    PARAGRAPH = "PARAGRAPH"
    QUIZ = "QUIZ"
    SLIDES = "SLIDES"
    STRUCTURED = "STRUCTURED"
    TIMELINE = "TIMELINE"

    def __str__(self) -> str:
        return str(self.value)
