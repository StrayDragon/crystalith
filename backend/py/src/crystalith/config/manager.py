from __future__ import annotations

import json
from pathlib import Path

from .models import Settings


class ConfigManager:
    def __init__(self, config_path: Path, schema_path: Path | None = None) -> None:
        self.config_path = config_path
        self.schema_path = schema_path or Path("config/schema.json")
        self._settings: Settings | None = None

    def load(self) -> Settings:
        settings = Settings.from_yaml(self.config_path)
        self._settings = settings
        return settings

    def get(self) -> Settings:
        if self._settings is None:
            return self.load()
        return self._settings

    def write_schema(self) -> Path:
        schema = Settings.model_json_schema()
        self.schema_path.parent.mkdir(parents=True, exist_ok=True)
        self.schema_path.write_text(
            json.dumps(schema, ensure_ascii=False, indent=2),
            encoding="utf-8",
        )
        return self.schema_path

    def schema_reference(self) -> str:
        reference = self.schema_path.as_posix()
        if not reference.startswith((".", "/")):
            return f"./{reference}"
        return reference

    def schema_comment(self) -> str:
        return f"# yaml-language-server: $schema={self.schema_reference()}"
