from __future__ import annotations

from functools import lru_cache
from typing import Literal

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel

from crystalith.shared.plugins.render_types import PluginConfigSchema, RenderDescriptor
from crystalith.shared.types import OutputType, OutputTypeMeta


router = APIRouter(prefix="/v1/workspace", tags=["workspace-tools"])


ToolTone = Literal["slate", "blue", "green", "rose", "amber", "teal", "indigo"]


class WorkspaceTool(BaseModel):
    id: str
    label: str
    description: str
    tone: ToolTone
    output_type: OutputType
    prompt: str
    render_descriptor: RenderDescriptor | None = None
    config_schema: PluginConfigSchema | None = None
    badge: str | None = None
    enabled: bool = True


class WorkspaceToolsResponse(BaseModel):
    tools: list[WorkspaceTool]


class ConfigOption(BaseModel):
    """A single configuration option."""

    id: str
    label: str
    is_default: bool = False


class ToolConfigResponse(BaseModel):
    """Configuration options for a specific tool."""

    tool_id: str
    tool_label: str
    quantity_options: list[ConfigOption] | None = None
    difficulty_options: list[ConfigOption] | None = None
    topic_placeholder: str | None = None
    supports_topic: bool = True


# Default configuration options
DEFAULT_QUANTITY_OPTIONS = [
    ConfigOption(id="less", label="更少"),
    ConfigOption(id="standard", label="标准（默认）", is_default=True),
    ConfigOption(id="more", label="更多"),
]

DEFAULT_DIFFICULTY_OPTIONS = [
    ConfigOption(id="easy", label="简单"),
    ConfigOption(id="medium", label="中等（默认）", is_default=True),
    ConfigOption(id="hard", label="困难"),
]

# Tool-specific configurations
TOOL_CONFIGS: dict[str, dict] = {
    "faq": {
        "quantity_options": DEFAULT_QUANTITY_OPTIONS,
        "difficulty_options": None,  # FAQ doesn't have difficulty
        "topic_placeholder": "示例提示\n• 抽认卡必须仅限于一个特定来源（例如「一篇介绍意大利的文章」）\n• 抽认卡必须专注于一个特定主题（例如「牛顿第二定律」）\n• 卡片正面内容必须简短易记（1-5 个字词）",
    },
    "guide": {
        "quantity_options": [
            ConfigOption(id="brief", label="简要"),
            ConfigOption(id="standard", label="标准（默认）", is_default=True),
            ConfigOption(id="detailed", label="详细"),
        ],
        "difficulty_options": DEFAULT_DIFFICULTY_OPTIONS,
        "topic_placeholder": "指南应该聚焦于什么主题？\n例如：入门指南、最佳实践、常见问题解决方案",
    },
    "timeline": {
        "quantity_options": DEFAULT_QUANTITY_OPTIONS,
        "difficulty_options": None,
        "topic_placeholder": "时间轴应该覆盖什么时间范围或事件类型？\n例如：技术发展历程、项目里程碑",
    },
    "mindmap": {
        "quantity_options": [
            ConfigOption(id="shallow", label="浅层（2层）"),
            ConfigOption(id="standard", label="标准（3层）", is_default=True),
            ConfigOption(id="deep", label="深层（4层）"),
        ],
        "difficulty_options": None,
        "topic_placeholder": "思维导图的核心主题是什么？\n例如：系统架构、知识体系",
    },
    "quiz": {
        "quantity_options": DEFAULT_QUANTITY_OPTIONS,
        "difficulty_options": DEFAULT_DIFFICULTY_OPTIONS,
        "topic_placeholder": "测验应该测试什么知识点？\n例如：基础概念、高级应用、综合理解",
    },
    "briefing": {
        "quantity_options": [
            ConfigOption(id="executive", label="高管摘要"),
            ConfigOption(id="standard", label="标准报告（默认）", is_default=True),
            ConfigOption(id="comprehensive", label="详尽报告"),
        ],
        "difficulty_options": None,
        "topic_placeholder": "报告应该重点关注什么方面？\n例如：技术分析、市场趋势、风险评估",
    },
    "slides": {
        "quantity_options": [
            ConfigOption(id="short", label="精简"),
            ConfigOption(id="standard", label="标准（默认）", is_default=True),
            ConfigOption(id="detailed", label="详尽"),
        ],
        "difficulty_options": None,
        "topic_placeholder": "演示应该围绕什么主题？\n例如：项目复盘、产品发布、技术方案介绍",
    },
}


@lru_cache(maxsize=1)
def _build_tools() -> list[WorkspaceTool]:
    """Build workspace tools from OutputType metadata."""
    tools: list[WorkspaceTool] = []
    for output_type in OutputType.get_tool_types():
        meta: OutputTypeMeta = output_type.x_meta  # pyright: ignore[reportAttributeAccessIssue]
        tools.append(
            WorkspaceTool(
                id=output_type.value.lower(),
                label=meta.display_text,
                description=meta.description,
                tone=meta.tone,  # pyright: ignore[reportArgumentType]
                output_type=output_type,
                prompt=meta.prompt,
            )
        )
    return tools


def _get_tool_by_id(tool_id: str) -> WorkspaceTool | None:
    """Get a tool by its ID."""
    for tool in _build_tools():
        if tool.id == tool_id:
            return tool
    return None


@router.get("/tools", response_model=WorkspaceToolsResponse)
async def list_workspace_tools(request: Request) -> WorkspaceToolsResponse:
    plugins = getattr(request.app.state, "plugins", None)
    if plugins is None:
        return WorkspaceToolsResponse(tools=_build_tools())

    tools: list[WorkspaceTool] = []
    for tool in _build_tools():
        tools.append(
            tool.model_copy(
                update={
                    "render_descriptor": plugins.get_render_descriptor(tool.output_type.value),
                    "config_schema": plugins.get_config_schema(tool.output_type.value),
                }
            )
        )

    return WorkspaceToolsResponse(tools=tools)


@router.get("/tools/{tool_id}/config", response_model=ToolConfigResponse)
async def get_tool_config(tool_id: str) -> ToolConfigResponse:
    """Get configuration options for a specific tool."""
    tool = _get_tool_by_id(tool_id)
    if tool is None:
        raise HTTPException(status_code=404, detail="Tool not found")

    config = TOOL_CONFIGS.get(tool_id, {})

    return ToolConfigResponse(
        tool_id=tool_id,
        tool_label=tool.label,
        quantity_options=config.get("quantity_options", DEFAULT_QUANTITY_OPTIONS),
        difficulty_options=config.get("difficulty_options", DEFAULT_DIFFICULTY_OPTIONS),
        topic_placeholder=config.get(
            "topic_placeholder",
            "主题应该是什么？",
        ),
        supports_topic=True,
    )
