from __future__ import annotations

from pathlib import Path

OUTPUT_ROOT = Path("./data/output")
PREVIEW_DIR = OUTPUT_ROOT / "preview"
PREVIEW_MARKDOWN_NAME = "slides.md"


def get_slide_dir(notebook_id: int, slide_id: int) -> Path:
    return OUTPUT_ROOT / str(notebook_id) / str(slide_id)


def get_slide_markdown_path(notebook_id: int, slide_id: int) -> Path:
    return get_slide_dir(notebook_id, slide_id) / "slides.md"


def get_preview_markdown_path() -> Path:
    return PREVIEW_DIR / PREVIEW_MARKDOWN_NAME


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
    PREVIEW_DIR.mkdir(parents=True, exist_ok=True)
    path = get_preview_markdown_path()
    if path.exists():
        existing = path.read_text(encoding="utf-8")
        if existing.rstrip() == markdown.rstrip():
            return path
    path.write_text(markdown, encoding="utf-8")
    return path
