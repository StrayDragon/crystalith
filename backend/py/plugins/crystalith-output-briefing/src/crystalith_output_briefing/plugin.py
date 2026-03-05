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


class BriefingSection(BaseModel):
    heading: str
    points: list[CitedText] = Field(default_factory=list)


class BriefingOutput(BaseModel):
    sections: list[BriefingSection] = Field(default_factory=list)


class BriefingOutputPlugin:
    api_version = "v1"

    output_type = "BRIEFING"
    schema = BriefingOutput
    default_prompt = "Create an executive briefing from the sources."

    metadata = OutputTypePluginMeta(
        description="高层摘要",
        display_text="报告",
        tone="amber",
    )

    render_descriptor = RenderDescriptor(
        layout="sections",
        item_schema=ItemSchema(
            fields=[
                FieldDescriptor(key="heading", type="heading", label="章节"),
                FieldDescriptor(key="points", type="list", label="要点"),
            ]
        ),
        options={"items_key": "sections"},
    )

    config_schema = PluginConfigSchema(
        quantity_options=[
            ConfigOption(id="executive", label="高管摘要"),
            ConfigOption(id="standard", label="标准报告（默认）", is_default=True),
            ConfigOption(id="comprehensive", label="详尽报告"),
        ],
        difficulty_options=[],
        topic_placeholder="报告应该重点关注什么方面？\n例如：技术分析、市场趋势、风险评估",
        supports_topic=True,
    )

    frontend_bundle = FrontendBundleDescriptor(id="output-briefing", export="render")


plugin = BriefingOutputPlugin()

