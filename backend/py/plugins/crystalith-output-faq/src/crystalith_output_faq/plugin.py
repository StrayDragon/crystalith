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


class FAQItem(BaseModel):
    question: str
    answer: str
    citations: list[int] = Field(default_factory=list)


class FAQOutput(BaseModel):
    items: list[FAQItem] = Field(default_factory=list)


class FAQOutputPlugin:
    api_version = "v1"

    output_type = "FAQ"
    schema = FAQOutput
    default_prompt = "Generate a FAQ from the sources."

    metadata = OutputTypePluginMeta(
        description="问答清单",
        display_text="闪卡",
        tone="blue",
    )

    render_descriptor = RenderDescriptor(
        layout="cards",
        item_schema=ItemSchema(
            fields=[
                FieldDescriptor(key="question", type="heading", label="问题"),
                FieldDescriptor(key="answer", type="text", label="回答"),
                FieldDescriptor(key="citations", type="citation", label=None),
            ]
        ),
        options={"items_key": "items"},
    )

    config_schema = PluginConfigSchema(
        quantity_options=[
            ConfigOption(id="less", label="更少"),
            ConfigOption(id="standard", label="标准（默认）", is_default=True),
            ConfigOption(id="more", label="更多"),
        ],
        difficulty_options=[],
        topic_placeholder=(
            "示例提示\n"
            "• 抽认卡必须仅限于一个特定来源（例如「一篇介绍意大利的文章」）\n"
            "• 抽认卡必须专注于一个特定主题（例如「牛顿第二定律」）\n"
            "• 卡片正面内容必须简短易记（1-5 个字词）"
        ),
        supports_topic=True,
    )

    frontend_bundle = FrontendBundleDescriptor(id="output-faq", export="render")


plugin = FAQOutputPlugin()

