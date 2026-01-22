from __future__ import annotations

from functools import lru_cache
from typing import Literal

from fastapi import APIRouter
from pydantic import BaseModel

from crystalith.outputs.types import OutputType, OutputTypeMeta


router = APIRouter(prefix="/v1/workspace", tags=["workspace-tools"])


ToolTone = Literal["slate", "blue", "green", "rose", "amber", "teal", "indigo"]


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


@router.get("/tools", response_model=WorkspaceToolsResponse)
async def list_workspace_tools() -> WorkspaceToolsResponse:
    return WorkspaceToolsResponse(tools=_build_tools())
