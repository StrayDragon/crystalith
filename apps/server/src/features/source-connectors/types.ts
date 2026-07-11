// Source connector API types — mirrors v1 features/source_connectors/schemas.py

export interface Diagnostic {
  error_code: string;
  message: string;
  hint?: string | null;
  details?: unknown;
}

export interface SourceConnectorCapabilities {
  supports_snapshot: boolean;
  supports_sync_check: boolean;
}

export interface SourceConnectorDescriptor {
  connector_id: string;
  display_name: string;
  description?: string | null;
  connection_config_schema: Record<string, unknown>;
  diagnostics?: Diagnostic[] | null;
  capabilities: SourceConnectorCapabilities;
}

export interface FrontmatterSummary {
  title?: string | null;
  tags?: string[] | null;
  aliases?: string[] | null;
  date?: string | null;
}

export interface SnapshotEntry {
  relative_path: string;
  size_bytes: number;
  modified_at: string;
  content_hash?: string;
  frontmatter_summary?: FrontmatterSummary;
}

export interface Snapshot {
  generated_at: string;
  entries: SnapshotEntry[];
}

export interface ImportScope {
  include_directories?: string[] | null;
  include_files?: string[] | null;
}

export interface SyncCandidate {
  relative_path: string;
  current?: SnapshotEntry | null;
  base?: SnapshotEntry | null;
  reason?: string | null;
}

export interface SyncCandidates {
  added: SyncCandidate[];
  updated: SyncCandidate[];
  missing: SyncCandidate[];
}

export interface SyncCheckResult {
  id: string;
  checked_at: string;
  base_snapshot?: Snapshot | null;
  current_snapshot: Snapshot;
  candidates: SyncCandidates;
}

export interface ConnectorBindingRead {
  id: number;
  notebook_id: number;
  connector_id: string;
  connection_config: Record<string, unknown>;
  import_scope?: ImportScope | null;
  last_confirmed_snapshot?: Snapshot | null;
  last_sync_check_result?: SyncCheckResult | null;
  created_at: string;
  updated_at: string;
}

export interface ImportResultItem {
  relative_path: string;
  status: 'imported' | 'reused' | 'skipped' | 'failed';
  source_id?: number | null;
  diagnostic?: Diagnostic | null;
}

export interface ImportScopeApplyResponse {
  binding: ConnectorBindingRead;
  imported_source_ids: number[];
  reused_source_ids: number[];
  results: ImportResultItem[];
}
