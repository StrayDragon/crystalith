from __future__ import annotations

from pydantic import BaseModel, ConfigDict, Field


class SlideOutlineItem(BaseModel):
    model_config = ConfigDict(extra="forbid")

    title: str
    bullets: list[str] = Field(default_factory=list)


class SlideOutline(BaseModel):
    model_config = ConfigDict(extra="forbid")

    title: str
    slides: list[SlideOutlineItem]


class SlideMarkdown(BaseModel):
    model_config = ConfigDict(extra="forbid")

    markdown: str


class SlideGenerationConfig(BaseModel):
    model_config = ConfigDict(extra="allow")

    quantity: str | None = None
    audience: str | None = None
    structure: str | None = None
    tone: str | None = None
    language: str | None = None
    density: str | None = None
    theme_preset: str | None = None
    frontmatter: str | None = None
