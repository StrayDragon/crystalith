from enum import Enum


class SlideStatus(str, Enum):
    ERROR = "error"
    IDLE = "idle"
    RUNNING = "running"

    def __str__(self) -> str:
        return str(self.value)
