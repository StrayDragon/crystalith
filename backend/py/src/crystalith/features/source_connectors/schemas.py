from __future__ import annotations

import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

from crystalith.shared.json_types import JsonDict, JsonValue


class Diagnostic(BaseModel):
    error_code: str
    message: str
    hint: str | None = None
    details: JsonValue | None = None


class SourceConnectorCapabilities(BaseModel):
    supports_snapshot: bool = True
    supports_sync_check: bool = True


class SourceConnectorDescriptor(BaseModel):
    connector_id: str
    display_name: str
    description: str | None = None
    connection_config_schema: JsonDict
    diagnostics: list[Diagnostic] | None = None
    capabilities: SourceConnectorCapabilities


class SourceConnectorsListResponse(BaseModel):
    connectors: list[SourceConnectorDescriptor] = Field(default_factory=list)


class FrontmatterSummary(BaseModel):
    title: str | None = None
    tags: list[str] | None = None
    aliases: list[str] | None = None
    date: str | None = None


class SnapshotEntry(BaseModel):
    relative_path: str
    size_bytes: int = Field(..., ge=0)
    modified_at: str
    frontmatter_summary: FrontmatterSummary = Field(default_factory=FrontmatterSummary)


class Snapshot(BaseModel):
    generated_at: datetime.datetime
    entries: list[SnapshotEntry] = Field(default_factory=list)


class ImportScope(BaseModel):
    include_directories: list[str] | None = None
    include_files: list[str] | None = None


class SyncCandidate(BaseModel):
    relative_path: str
    current: SnapshotEntry | None = None
    base: SnapshotEntry | None = None
    reason: str | None = None


class SyncCandidates(BaseModel):
    added: list[SyncCandidate] = Field(default_factory=list)
    updated: list[SyncCandidate] = Field(default_factory=list)
    missing: list[SyncCandidate] = Field(default_factory=list)


class SyncCheckResult(BaseModel):
    id: str
    checked_at: datetime.datetime
    base_snapshot: Snapshot | None = None
    current_snapshot: Snapshot
    candidates: SyncCandidates


class ApplySyncCheckRequest(BaseModel):
    sync_check_id: str


class CreateConnectorBindingRequest(BaseModel):
    connection_config: JsonDict = Field(default_factory=dict)


class ConnectorBindingRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    notebook_id: int
    connector_id: str
    connection_config: JsonDict
    import_scope: ImportScope | None = None
    last_confirmed_snapshot: Snapshot | None = None
    last_sync_check_result: SyncCheckResult | None = None
    created_at: datetime.datetime
    updated_at: datetime.datetime


class ImportResultItem(BaseModel):
    relative_path: str
    status: Literal["imported", "reused", "skipped", "failed"]
    source_id: int | None = None
    diagnostic: Diagnostic | None = None


class ImportScopeApplyResponse(BaseModel):
    binding: ConnectorBindingRead
    imported_source_ids: list[int] = Field(default_factory=list)
    reused_source_ids: list[int] = Field(default_factory=list)
    results: list[ImportResultItem] = Field(default_factory=list)
