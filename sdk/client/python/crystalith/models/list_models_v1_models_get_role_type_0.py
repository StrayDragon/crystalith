from enum import Enum


class ListModelsV1ModelsGetRoleType0(str, Enum):
    AUTOCOMPLETE = "autocomplete"
    CHAT = "chat"
    EDIT = "edit"
    EMBED = "embed"

    def __str__(self) -> str:
        return str(self.value)
