from enum import Enum


class SourceFromUrlMode(str, Enum):
    FETCH = "fetch"
    LINK = "link"

    def __str__(self) -> str:
        return str(self.value)
