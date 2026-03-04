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


class CitedText(BaseModel):
    text: str
    citations: list[int] = Field(default_factory=list)


class GuideModule(BaseModel):
    title: str
    objective: CitedText
    key_points: list[CitedText] = Field(default_factory=list)
    examples: list[CitedText] = Field(default_factory=list)
    exercises: list[CitedText] = Field(default_factory=list)


class GuideOutput(BaseModel):
    modules: list[GuideModule] = Field(default_factory=list)


class GuideOutputPlugin:
    api_version = "v1"

    output_type = "GUIDE"
    schema = GuideOutput
    default_prompt = "Create a study guide from the sources."

    metadata = OutputTypePluginMeta(
        description="学习/行动指南",
        display_text="指南",
        tone="green",
    )

    render_descriptor = RenderDescriptor(
        layout="sections",
        item_schema=ItemSchema(
            fields=[
                FieldDescriptor(key="title", type="heading", label="模块"),
                FieldDescriptor(key="objective", type="text", label="目标"),
                FieldDescriptor(key="key_points", type="list", label="要点"),
            ]
        ),
        options={"items_key": "modules"},
    )

    config_schema = PluginConfigSchema(
        quantity_options=[
            ConfigOption(id="brief", label="简要"),
            ConfigOption(id="standard", label="标准（默认）", is_default=True),
            ConfigOption(id="detailed", label="详细"),
        ],
        difficulty_options=[
            ConfigOption(id="easy", label="简单"),
            ConfigOption(id="medium", label="中等（默认）", is_default=True),
            ConfigOption(id="hard", label="困难"),
        ],
        topic_placeholder="指南应该聚焦于什么主题？\n例如：入门指南、最佳实践、常见问题解决方案",
        supports_topic=True,
    )

    frontend_bundle = FrontendBundleDescriptor(id="output-guide", export="render")


plugin = GuideOutputPlugin()

