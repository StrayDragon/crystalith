from __future__ import annotations

from typing import Literal

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


class QuizQuestion(BaseModel):
    type: Literal["multiple_choice", "short_answer"] = "multiple_choice"
    question: str
    options: list[str] = Field(default_factory=list)
    answer: str
    explanation: str = ""
    citations: list[int] = Field(default_factory=list)


class QuizOutput(BaseModel):
    questions: list[QuizQuestion] = Field(default_factory=list)


class QuizOutputPlugin:
    api_version = "v1"

    output_type = "QUIZ"
    schema = QuizOutput
    default_prompt = "Create a quiz from the sources."

    metadata = OutputTypePluginMeta(
        description="知识检验",
        display_text="测验",
        tone="teal",
    )

    render_descriptor = RenderDescriptor(
        layout="cards",
        item_schema=ItemSchema(
            fields=[
                FieldDescriptor(key="question", type="heading", label="问题"),
                FieldDescriptor(key="options", type="list", label="选项"),
                FieldDescriptor(key="answer", type="badge", label="答案"),
                FieldDescriptor(key="explanation", type="text", label="解析"),
                FieldDescriptor(key="citations", type="citation", label=None),
            ]
        ),
        options={"items_key": "questions"},
    )

    config_schema = PluginConfigSchema(
        quantity_options=[
            ConfigOption(id="less", label="更少"),
            ConfigOption(id="standard", label="标准（默认）", is_default=True),
            ConfigOption(id="more", label="更多"),
        ],
        difficulty_options=[
            ConfigOption(id="easy", label="简单"),
            ConfigOption(id="medium", label="中等（默认）", is_default=True),
            ConfigOption(id="hard", label="困难"),
        ],
        topic_placeholder="测验应该测试什么知识点？\n例如：基础概念、高级应用、综合理解",
        supports_topic=True,
    )

    frontend_bundle = FrontendBundleDescriptor(id="output-quiz", export="render")


plugin = QuizOutputPlugin()
