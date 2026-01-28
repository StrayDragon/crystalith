from enum import Enum


class ListResearchSessionsV1NotebooksNotebookIdResearchGetResearchStatus(str, Enum):
    ANALYZING = "analyzing"
    CANCELLED = "cancelled"
    COMPLETED = "completed"
    PLANNING = "planning"
    SEARCHING = "searching"
    WAITING_USER = "waiting_user"

    def __str__(self) -> str:
        return str(self.value)
