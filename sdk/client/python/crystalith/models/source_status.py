from enum import Enum


class SourceStatus(str, Enum):
    FAILED = "failed"
    PROCESSING = "processing"
    READY = "ready"

    def __str__(self) -> str:
        return str(self.value)
