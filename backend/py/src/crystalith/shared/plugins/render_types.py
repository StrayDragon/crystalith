from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


ToolTone = Literal["slate", "blue", "green", "rose", "amber", "teal", "indigo"]
RenderLayout = Literal["list", "cards", "tree", "timeline", "sections", "table"]
RenderFieldType = Literal[
    "text",
    "heading",
    "badge",
    "list",
    "tree",
    "date",
    "citation",
    "code",
]


class OutputTypePluginMeta(BaseModel):
    model_config = ConfigDict(extra="forbid")

    description: str
    display_text: str
    tone: ToolTone = "slate"


class FieldDescriptor(BaseModel):
    model_config = ConfigDict(extra="forbid")

    key: str
    type: RenderFieldType
    label: str | None = None
    children: list[FieldDescriptor] = Field(default_factory=list)


class ItemSchema(BaseModel):
    model_config = ConfigDict(extra="forbid")

    fields: list[FieldDescriptor] = Field(default_factory=list)


class RenderDescriptor(BaseModel):
    model_config = ConfigDict(extra="forbid")

    layout: RenderLayout
    item_schema: ItemSchema | None = None
    options: dict[str, object] = Field(default_factory=dict)


class ConfigOption(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: str
    label: str
    is_default: bool = False


class PluginConfigSchema(BaseModel):
    model_config = ConfigDict(extra="forbid")

    quantity_options: list[ConfigOption] = Field(default_factory=list)
    difficulty_options: list[ConfigOption] = Field(default_factory=list)
    topic_placeholder: str = ""
    supports_topic: bool = True


FrontendBundleKind = Literal["builtin"]
FrontendBundleApiVersion = Literal["v1"]


class FrontendBundleDescriptor(BaseModel):
    """
    Declarative frontend renderer bundle descriptor.

    v1 only supports `kind="builtin"`: the bundle must be shipped inside the
    frontend build and resolved via a deterministic registry (id -> loader).
    """

    model_config = ConfigDict(extra="forbid")

    api_version: FrontendBundleApiVersion = "v1"
    kind: FrontendBundleKind = "builtin"

    id: str
    export: str = "render"
    meta: dict[str, object] = Field(default_factory=dict)


FieldDescriptor.model_rebuild()
ItemSchema.model_rebuild()
RenderDescriptor.model_rebuild()
PluginConfigSchema.model_rebuild()
FrontendBundleDescriptor.model_rebuild()
