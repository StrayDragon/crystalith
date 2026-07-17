// Source connector API types — mirrors v1 features/source_connectors/schemas.py

export interface Diagnostic {
  errorCode: string;
  message: string;
  hint?: string | null;
  details?: unknown;
}

export interface SourceConnectorCapabilities {
  supportsSnapshot: boolean;
  supportsSyncCheck: boolean;
}

export interface SourceConnectorDescriptor {
  connectorId: string;
  displayName: string;
  description?: string | null;
  connectionConfigSchema: Record<string, unknown>;
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
  relativePath: string;
  sizeBytes: number;
  modifiedAt: string;
  contentHash?: string;
  frontmatterSummary?: FrontmatterSummary;
}

export interface Snapshot {
  generatedAt: string;
  entries: SnapshotEntry[];
}

export interface ImportScope {
  includeDirectories?: string[] | null;
  includeFiles?: string[] | null;
}

export interface SyncCandidate {
  relativePath: string;
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
  checkedAt: string;
  baseSnapshot?: Snapshot | null;
  currentSnapshot: Snapshot;
  candidates: SyncCandidates;
}

export interface ConnectorBindingRead {
  id: number;
  notebookId: number;
  connectorId: string;
  connectionConfig: Record<string, unknown>;
  importScope?: ImportScope | null;
  lastConfirmedSnapshot?: Snapshot | null;
  lastSyncCheckResult?: SyncCheckResult | null;
  createdAt: string;
  updatedAt: string;
}

export interface ImportResultItem {
  relativePath: string;
  status: 'imported' | 'reused' | 'skipped' | 'failed';
  sourceId?: number | null;
  diagnostic?: Diagnostic | null;
}

export interface ImportScopeApplyResponse {
  binding: ConnectorBindingRead;
  importedSourceIds: number[];
  reusedSourceIds: number[];
  results: ImportResultItem[];
}
