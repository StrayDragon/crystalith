from enum import Enum


class QAMessageRole(str, Enum):
    ASSISTANT = "assistant"
    USER = "user"

    def __str__(self) -> str:
        return str(self.value)
