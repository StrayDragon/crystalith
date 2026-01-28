from enum import Enum


class TaskType(str, Enum):
    DOCUMENT_PARSE = "document_parse"
    REFINE = "refine"

    def __str__(self) -> str:
        return str(self.value)
