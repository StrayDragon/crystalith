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


class TimelineEvent(BaseModel):
    date: str
    event: str
    description: str
    citations: list[int] = Field(default_factory=list)


class TimelineOutput(BaseModel):
    events: list[TimelineEvent] = Field(default_factory=list)


class TimelineOutputPlugin:
    api_version = "v1"

    output_type = "TIMELINE"
    schema = TimelineOutput
    default_prompt = "Create a timeline from the sources."

    metadata = OutputTypePluginMeta(
        description="关键事件序列",
        display_text="时间轴",
        tone="rose",
    )

    render_descriptor = RenderDescriptor(
        layout="timeline",
        item_schema=ItemSchema(
            fields=[
                FieldDescriptor(key="date", type="date", label="日期"),
                FieldDescriptor(key="event", type="heading", label="事件"),
                FieldDescriptor(key="description", type="text", label="描述"),
                FieldDescriptor(key="citations", type="citation", label=None),
            ]
        ),
        options={"items_key": "events"},
    )

    config_schema = PluginConfigSchema(
        quantity_options=[
            ConfigOption(id="less", label="更少"),
            ConfigOption(id="standard", label="标准（默认）", is_default=True),
            ConfigOption(id="more", label="更多"),
        ],
        difficulty_options=[],
        topic_placeholder="时间轴应该覆盖什么时间范围或事件类型？\n例如：技术发展历程、项目里程碑",
        supports_topic=True,
    )

    frontend_bundle = FrontendBundleDescriptor(id="output-timeline", export="render")


plugin = TimelineOutputPlugin()
