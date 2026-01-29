from enum import Enum


class ModelReadProvider(str, Enum):
    OLLAMA = "ollama"
    OPENAI = "openai"

    def __str__(self) -> str:
        return str(self.value)
