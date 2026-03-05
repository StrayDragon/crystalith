from __future__ import annotations

from collections.abc import Sequence
from typing import Literal, Protocol, cast

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from crystalith.shared.config import Settings
from crystalith.shared.deps import get_plugin_registry, get_settings
from crystalith.shared.json_types import JsonValue
from crystalith.shared.plugins import PluginRegistry
from crystalith.shared.plugins.official_catalog import OFFICIAL_PLUGIN_CATALOG
from crystalith.shared.plugins.render_types import (
    FrontendBundleDescriptor,
    PluginConfigSchema,
    RenderDescriptor,
    ToolTone,
)
from crystalith.shared.types import OutputType


router = APIRouter(prefix="/v1/workspace", tags=["workspace-tools"])


class WorkspaceTool(BaseModel):
    id: str
    label: str
    description: str
    tone: ToolTone
    output_type: OutputType
    prompt: str
    render_descriptor: RenderDescriptor | None = None
    config_schema: PluginConfigSchema | None = None
    frontend_bundle: FrontendBundleDescriptor | None = None
    badge: str | None = None
    enabled: bool = True


class PluginSkipDetailResponse(BaseModel):
    error_code: str
    message: str
    hint: str | None = None
    details: dict[str, JsonValue] | None = None


class ToolsPluginDiagnostics(BaseModel):
    loaded: list[str] = Field(default_factory=list)
    skipped: dict[str, PluginSkipDetailResponse] = Field(default_factory=dict)


OfficialPluginStatus = Literal["loaded", "skipped", "not_installed"]


class OfficialPluginDiagnostic(BaseModel):
    status: OfficialPluginStatus
    hint: str | None = None
    details: dict[str, JsonValue] | None = None


class WorkspaceToolsDiagnostics(BaseModel):
    plugins: ToolsPluginDiagnostics
    official: dict[str, OfficialPluginDiagnostic] = Field(default_factory=dict)


class WorkspaceToolsResponse(BaseModel):
    tools: list[WorkspaceTool]
    diagnostics: WorkspaceToolsDiagnostics


class ConfigOption(BaseModel):
    id: str
    label: str
    is_default: bool = False


class ToolConfigResponse(BaseModel):
    tool_id: str
    tool_label: str
    quantity_options: list[ConfigOption] | None = None
    difficulty_options: list[ConfigOption] | None = None
    topic_placeholder: str | None = None
    supports_topic: bool = True


class _OptionLike(Protocol):
    id: str
    label: str
    is_default: bool


def _tool_from_output_plugin(
    *,
    output_type: OutputType,
    plugins: PluginRegistry,
    frontend_bundles_enabled: bool,
) -> WorkspaceTool | None:
    plugin = plugins.output_types.get(output_type.value)
    if plugin is None:
        return None

    meta = plugins.get_output_type_metadata(output_type.value)
    if meta is None:
        return None

    frontend_bundle: FrontendBundleDescriptor | None = None
    if frontend_bundles_enabled:
        frontend_bundle = plugins.get_frontend_bundle(output_type.value)

    return WorkspaceTool(
        id=output_type.value.lower(),
        label=meta.display_text,
        description=meta.description,
        tone=meta.tone,
        output_type=output_type,
        prompt=plugin.default_prompt or "",
        render_descriptor=plugins.get_render_descriptor(output_type.value),
        config_schema=plugins.get_config_schema(output_type.value),
        frontend_bundle=frontend_bundle,
        enabled=True,
    )


def _slides_tool(*, frontend_bundles_enabled: bool) -> WorkspaceTool:
    meta = OutputType.SLIDES.meta
    frontend_bundle = (
        FrontendBundleDescriptor(id="output-slides", export="render") if frontend_bundles_enabled else None
    )
    return WorkspaceTool(
        id=OutputType.SLIDES.value.lower(),
        label=meta.display_text,
        description=meta.description,
        tone=cast(ToolTone, meta.tone),
        output_type=OutputType.SLIDES,
        prompt=meta.prompt,
        render_descriptor=None,
        config_schema=None,
        frontend_bundle=frontend_bundle,
        enabled=True,
    )


def _build_diagnostics(*, plugins: PluginRegistry) -> WorkspaceToolsDiagnostics:
    report = plugins.get_load_report()

    skipped: dict[str, PluginSkipDetailResponse] = {}
    for plugin_id, detail in report.skipped.items():
        payload = detail.to_dict()
        details = payload.get("details")
        skipped[plugin_id] = PluginSkipDetailResponse(
            error_code=str(payload.get("error_code") or ""),
            message=str(payload.get("message") or ""),
            hint=cast(str | None, payload.get("hint")),
            details=cast(dict[str, JsonValue] | None, details) if isinstance(details, dict) else None,
        )

    loaded = list(report.loaded)

    official: dict[str, OfficialPluginDiagnostic] = {}
    loaded_set = set(loaded)
    for plugin_id, catalog_entry in OFFICIAL_PLUGIN_CATALOG.items():
        if plugin_id in loaded_set:
            official[plugin_id] = OfficialPluginDiagnostic(status="loaded")
            continue
        skip_detail = report.skipped.get(plugin_id)
        if skip_detail is not None:
            official[plugin_id] = OfficialPluginDiagnostic(
                status="skipped",
                hint=skip_detail.hint,
                details=cast(dict[str, JsonValue], skip_detail.to_dict()),
            )
            continue
        official[plugin_id] = OfficialPluginDiagnostic(
            status="not_installed",
            hint=catalog_entry.default_install_hint(),
            details={"package": catalog_entry.package, "kind": catalog_entry.kind},
        )

    return WorkspaceToolsDiagnostics(
        plugins=ToolsPluginDiagnostics(loaded=loaded, skipped=skipped),
        official=official,
    )


@router.get("/tools", response_model=WorkspaceToolsResponse)
async def list_workspace_tools(
    settings: Settings = Depends(get_settings),
    plugins: PluginRegistry = Depends(get_plugin_registry),
) -> WorkspaceToolsResponse:
    frontend_bundles_enabled = settings.app.features.workspace_frontend_bundles_enabled

    tools: list[WorkspaceTool] = []

    # Built-in tool (kept in this change): SLIDES
    tools.append(_slides_tool(frontend_bundles_enabled=frontend_bundles_enabled))

    # Plugin-provided tool output types
    order_index = {item.value: idx for idx, item in enumerate(OutputType)}
    for output_type in OutputType:
        if output_type == OutputType.SLIDES:
            continue
        tool = _tool_from_output_plugin(
            output_type=output_type,
            plugins=plugins,
            frontend_bundles_enabled=frontend_bundles_enabled,
        )
        if tool is not None:
            tools.append(tool)

    tools.sort(key=lambda item: order_index.get(item.output_type.value, 10_000))

    return WorkspaceToolsResponse(
        tools=tools,
        diagnostics=_build_diagnostics(plugins=plugins),
    )


@router.get("/tools/{tool_id}/config", response_model=ToolConfigResponse)
async def get_tool_config(
    tool_id: str,
    plugins: PluginRegistry = Depends(get_plugin_registry),
) -> ToolConfigResponse:
    normalized = tool_id.strip().upper()
    if normalized == OutputType.SLIDES.value:
        raise HTTPException(status_code=404, detail="Use /v1/workspace/tools/slides/config")

    try:
        output_type = OutputType(normalized)
    except ValueError:
        raise HTTPException(status_code=404, detail="Tool not found") from None

    plugin = plugins.output_types.get(output_type.value)
    if plugin is None:
        raise HTTPException(status_code=404, detail="Tool not found")

    meta = plugins.get_output_type_metadata(output_type.value)
    label = meta.display_text if meta is not None else output_type.value

    schema = plugins.get_config_schema(output_type.value)

    def _to_options(value: Sequence[_OptionLike] | None) -> list[ConfigOption] | None:
        if not value:
            return None
        options: list[ConfigOption] = []
        for option in value:
            options.append(
                ConfigOption(
                    id=str(option.id),
                    label=str(option.label),
                    is_default=bool(option.is_default),
                )
            )
        return options or None

    return ToolConfigResponse(
        tool_id=tool_id,
        tool_label=label,
        quantity_options=_to_options(schema.quantity_options) if schema is not None else None,
        difficulty_options=_to_options(schema.difficulty_options) if schema is not None else None,
        topic_placeholder=schema.topic_placeholder if schema is not None else None,
        supports_topic=bool(schema.supports_topic) if schema is not None else True,
    )
