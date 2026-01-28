from enum import Enum


class WorkspaceToolTone(str, Enum):
    AMBER = "amber"
    BLUE = "blue"
    GREEN = "green"
    INDIGO = "indigo"
    ROSE = "rose"
    SLATE = "slate"
    TEAL = "teal"

    def __str__(self) -> str:
        return str(self.value)
