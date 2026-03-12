from __future__ import annotations

import os
from pathlib import Path

from crystalith.shared.env import CRYSTALITH_DATA_DIR

PREVIEW_MARKDOWN_NAME = "slides.md"


def _data_dir() -> Path:
    data_dir_value = os.environ.get(CRYSTALITH_DATA_DIR)
    if data_dir_value and data_dir_value.strip():
        return Path(data_dir_value)

    cwd = Path.cwd()
    for parent in (cwd, *cwd.parents):
        candidate = parent / "config/app.yaml"
        if candidate.is_file():
            return candidate.parent.parent / "data"

    return Path("./data")


def _output_root() -> Path:
    return _data_dir() / "output"


def _preview_dir() -> Path:
    return _output_root() / "preview"


def get_slide_dir(notebook_id: int, slide_id: int) -> Path:
    return _output_root() / str(notebook_id) / str(slide_id)


def get_slide_markdown_path(notebook_id: int, slide_id: int) -> Path:
    return get_slide_dir(notebook_id, slide_id) / "slides.md"


def get_preview_markdown_path() -> Path:
    return _preview_dir() / PREVIEW_MARKDOWN_NAME


def write_slide_markdown(notebook_id: int, slide_id: int, markdown: str) -> Path:
    slide_dir = get_slide_dir(notebook_id, slide_id)
    slide_dir.mkdir(parents=True, exist_ok=True)
    path = get_slide_markdown_path(notebook_id, slide_id)
    if path.exists():
        existing = path.read_text(encoding="utf-8")
        if existing.rstrip() == markdown.rstrip():
            return path
    path.write_text(markdown, encoding="utf-8")
    return path


def write_preview_markdown(markdown: str) -> Path:
    preview_dir = _preview_dir()
    preview_dir.mkdir(parents=True, exist_ok=True)
    path = get_preview_markdown_path()
    if path.exists():
        existing = path.read_text(encoding="utf-8")
        if existing.rstrip() == markdown.rstrip():
            return path
    path.write_text(markdown, encoding="utf-8")
    return path
