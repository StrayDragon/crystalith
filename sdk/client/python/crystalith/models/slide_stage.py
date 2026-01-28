from enum import Enum


class SlideStage(str, Enum):
    INPUT = "input"
    MARKDOWN = "markdown"
    OUTLINE = "outline"

    def __str__(self) -> str:
        return str(self.value)
