from __future__ import annotations

from typing import Literal, cast

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


class SlidesWorkflowDiagnostic(BaseModel):
    active_plugin_id: str | None = None
    engine: str | None = None
    error_code: str | None = None
    message: str | None = None
    hint: str | None = None
    details: dict[str, JsonValue] | None = None


class WorkspaceToolsDiagnostics(BaseModel):
    plugins: ToolsPluginDiagnostics
    official: dict[str, OfficialPluginDiagnostic] = Field(default_factory=dict)
    slides: SlidesWorkflowDiagnostic | None = None


class WorkspaceToolsResponse(BaseModel):
    tools: list[WorkspaceTool]
    diagnostics: WorkspaceToolsDiagnostics


class ToolConfigResponse(PluginConfigSchema):
    tool_id: str
    tool_label: str


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


def _tool_from_slides_workflow(
    *,
    settings: Settings,
    plugins: PluginRegistry,
    frontend_bundles_enabled: bool,
) -> WorkspaceTool | None:
    selection = plugins.resolve_active_slides_workflow(settings)
    plugin = selection.plugin
    if plugin is None:
        return None

    fallback_meta = OutputType.SLIDES.meta
    meta = plugin.metadata or OutputType.SLIDES.meta
    frontend_bundle = plugin.frontend_bundle if frontend_bundles_enabled else None

    return WorkspaceTool(
        id=OutputType.SLIDES.value.lower(),
        label=meta.display_text,
        description=meta.description,
        tone=cast(ToolTone, meta.tone),
        output_type=OutputType.SLIDES,
        prompt=(plugin.default_prompt or fallback_meta.prompt),
        render_descriptor=None,
        config_schema=plugin.config_schema,
        frontend_bundle=frontend_bundle,
        enabled=True,
    )


def _build_diagnostics(*, settings: Settings, plugins: PluginRegistry) -> WorkspaceToolsDiagnostics:
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

    slides_selection = plugins.resolve_active_slides_workflow(settings)
    slides_diagnostic = SlidesWorkflowDiagnostic(
        active_plugin_id=slides_selection.plugin_id,
        engine=slides_selection.plugin.engine if slides_selection.plugin is not None else None,
        error_code=slides_selection.error_code,
        message=slides_selection.message,
        hint=slides_selection.hint,
        details=slides_selection.details or None,
    )

    return WorkspaceToolsDiagnostics(
        plugins=ToolsPluginDiagnostics(loaded=loaded, skipped=skipped),
        official=official,
        slides=slides_diagnostic,
    )


@router.get("/tools", response_model=WorkspaceToolsResponse)
async def list_workspace_tools(
    settings: Settings = Depends(get_settings),
    plugins: PluginRegistry = Depends(get_plugin_registry),
) -> WorkspaceToolsResponse:
    frontend_bundles_enabled = settings.app.features.workspace_frontend_bundles_enabled

    tools: list[WorkspaceTool] = []

    slides_tool = _tool_from_slides_workflow(
        settings=settings,
        plugins=plugins,
        frontend_bundles_enabled=frontend_bundles_enabled,
    )
    if slides_tool is not None:
        tools.append(slides_tool)

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
        diagnostics=_build_diagnostics(settings=settings, plugins=plugins),
    )


@router.get("/tools/{tool_id}/config", response_model=ToolConfigResponse)
async def get_tool_config(
    tool_id: str,
    settings: Settings = Depends(get_settings),
    plugins: PluginRegistry = Depends(get_plugin_registry),
) -> ToolConfigResponse:
    normalized = tool_id.strip().upper()

    try:
        output_type = OutputType(normalized)
    except ValueError:
        raise HTTPException(status_code=404, detail="Tool not found") from None

    if output_type == OutputType.SLIDES:
        selection = plugins.resolve_active_slides_workflow(settings)
        plugin = selection.plugin
        if plugin is None:
            raise HTTPException(status_code=404, detail=selection.to_error_detail())

        meta = plugin.metadata or OutputType.SLIDES.meta
        schema = plugin.config_schema
        return ToolConfigResponse(
            tool_id=tool_id,
            tool_label=meta.display_text,
            **schema.model_dump(),
        )

    plugin = plugins.output_types.get(output_type.value)
    if plugin is None:
        raise HTTPException(status_code=404, detail="Tool not found")

    meta = plugins.get_output_type_metadata(output_type.value)
    label = meta.display_text if meta is not None else output_type.value
    schema = plugins.get_config_schema(output_type.value) or PluginConfigSchema()

    return ToolConfigResponse(
        tool_id=tool_id,
        tool_label=label,
        **schema.model_dump(),
    )
