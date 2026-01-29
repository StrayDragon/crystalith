from enum import Enum


class RelationRelationType(str, Enum):
    CONTRADICTS = "contradicts"
    REFERENCES = "references"
    SIMILAR = "similar"

    def __str__(self) -> str:
        return str(self.value)
