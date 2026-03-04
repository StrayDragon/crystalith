from __future__ import annotations

from pydantic import BaseModel, Field

from crystalith.shared.plugins.render_types import (
    ConfigOption,
    FieldDescriptor,
    FrontendBundleDescriptor,
    ItemSchema,
    OutputTypePluginMeta,
    PluginConfigSchema,
    RenderDescriptor,
)


class MindmapNode(BaseModel):
    label: str
    citations: list[int] = Field(default_factory=list)
    children: list[MindmapNode] = Field(default_factory=list)


class MindmapOutput(BaseModel):
    root: MindmapNode


MindmapNode.model_rebuild()


class MindmapOutputPlugin:
    api_version = "v1"

    output_type = "MINDMAP"
    schema = MindmapOutput
    default_prompt = "Create a mindmap from the sources."

    metadata = OutputTypePluginMeta(
        description="主题层级结构",
        display_text="思维导图",
        tone="indigo",
    )

    render_descriptor = RenderDescriptor(
        layout="tree",
        item_schema=ItemSchema(
            fields=[
                FieldDescriptor(key="label", type="heading", label=None),
                FieldDescriptor(key="citations", type="citation", label=None),
            ]
        ),
        options={"root_key": "root", "children_key": "children", "label_key": "label"},
    )

    config_schema = PluginConfigSchema(
        quantity_options=[
            ConfigOption(id="shallow", label="浅层（2层）"),
            ConfigOption(id="standard", label="标准（3层）", is_default=True),
            ConfigOption(id="deep", label="深层（4层）"),
        ],
        difficulty_options=[],
        topic_placeholder="思维导图的核心主题是什么？\n例如：系统架构、知识体系",
        supports_topic=True,
    )

    frontend_bundle = FrontendBundleDescriptor(id="output-mindmap", export="render")


plugin = MindmapOutputPlugin()
