from __future__ import annotations

from enum import StrEnum

from fastapi import APIRouter
from pydantic import BaseModel

from crystalith.outputs.types import OutputType


router = APIRouter(prefix="/v1/workspace", tags=["workspace-tools"])


class ToolTone(StrEnum):
    SLATE = "slate"
    BLUE = "blue"
    GREEN = "green"
    ROSE = "rose"
    AMBER = "amber"
    TEAL = "teal"
    INDIGO = "indigo"


class WorkspaceTool(BaseModel):
    id: str
    label: str
    description: str
    tone: ToolTone
    output_type: OutputType
    prompt: str
    badge: str | None = None
    enabled: bool = True


class WorkspaceToolsResponse(BaseModel):
    tools: list[WorkspaceTool]


TOOLS: list[WorkspaceTool] = [
    WorkspaceTool(
        id="faq",
        label="闪卡",
        description="问答清单",
        tone=ToolTone.BLUE,
        output_type=OutputType.FAQ,
        prompt="整理为 FAQ 问答清单。",
    ),
    WorkspaceTool(
        id="guide",
        label="指南",
        description="学习/行动指南",
        tone=ToolTone.GREEN,
        output_type=OutputType.GUIDE,
        prompt="生成结构化学习指南。",
    ),
    WorkspaceTool(
        id="timeline",
        label="时间轴",
        description="关键事件序列",
        tone=ToolTone.ROSE,
        output_type=OutputType.TIMELINE,
        prompt="按时间轴整理关键事件。",
    ),
    WorkspaceTool(
        id="mindmap",
        label="思维导图",
        description="主题层级结构",
        tone=ToolTone.INDIGO,
        output_type=OutputType.MINDMAP,
        prompt="生成思维导图层级结构。",
    ),
    WorkspaceTool(
        id="quiz",
        label="测验",
        description="知识检验",
        tone=ToolTone.TEAL,
        output_type=OutputType.QUIZ,
        prompt="生成小测验题目。",
    ),
    WorkspaceTool(
        id="briefing",
        label="报告",
        description="高层摘要",
        tone=ToolTone.AMBER,
        output_type=OutputType.BRIEFING,
        prompt="生成简报：背景/发现/建议/下一步。",
    ),
]


@router.get("/tools", response_model=WorkspaceToolsResponse)
async def list_workspace_tools() -> WorkspaceToolsResponse:
    return WorkspaceToolsResponse(tools=TOOLS)
