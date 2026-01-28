from enum import Enum


class SourceSearchResponseSourceSearchStatus(str, Enum):
    NOT_IMPLEMENTED = "not_implemented"
    OK = "ok"

    def __str__(self) -> str:
        return str(self.value)
