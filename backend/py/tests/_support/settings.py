from __future__ import annotations

from crystalith.shared.config import Settings


def make_settings(payload: object) -> Settings:
    return Settings.model_validate(payload)
