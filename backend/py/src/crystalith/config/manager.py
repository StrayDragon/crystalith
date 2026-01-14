from __future__ import annotations

import json
import logging
from pathlib import Path

from pydantic import ValidationError

from .models import Settings

logger = logging.getLogger(__name__)


class ConfigManager:
    def __init__(self, config_path: Path, schema_path: Path | None = None) -> None:
        self.config_path = config_path
        self.schema_path = schema_path or Path("config/schema.json")
        self._settings: Settings | None = None

    def load(self) -> Settings:
        try:
            logger.info("Loading config from %s", self.config_path.resolve())
            settings = Settings.from_yaml(self.config_path)
        except FileNotFoundError as exc:
            raise FileNotFoundError(f"Config file not found: {self.config_path}") from exc
        except ValidationError as exc:
            raise ValueError(
                f"Invalid YAML config at {self.config_path}:\n{exc}"
            ) from exc
        except Exception as exc:
            raise ValueError(
                f"Failed to load YAML config at {self.config_path}: {exc}"
            ) from exc
        self._settings = settings
        logger.info("Loaded config from %s", self.config_path.resolve())
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
        reference_path = self.schema_path
        try:
            reference_path = self.schema_path.relative_to(self.config_path.parent)
        except ValueError:
            reference_path = self.schema_path

        reference = reference_path.as_posix()
        if not reference.startswith((".", "/")):
            return f"./{reference}"
        return reference

    def schema_comment(self) -> str:
        return f"# yaml-language-server: $schema={self.schema_reference()}"
