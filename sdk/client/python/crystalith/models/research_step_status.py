from enum import Enum


class ResearchStepStatus(str, Enum):
    COMPLETED = "completed"
    PENDING = "pending"
    RUNNING = "running"
    SKIPPED = "skipped"

    def __str__(self) -> str:
        return str(self.value)
