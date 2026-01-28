from enum import Enum


class SourceSearchStatus(str, Enum):
    NOT_IMPLEMENTED = "not_implemented"
    OK = "ok"

    def __str__(self) -> str:
        return str(self.value)
