from enum import Enum


class ResearchStepType(str, Enum):
    ANALYZE = "analyze"
    PLAN = "plan"
    SEARCH = "search"
    SUMMARY = "summary"
    USER_INPUT = "user_input"

    def __str__(self) -> str:
        return str(self.value)
