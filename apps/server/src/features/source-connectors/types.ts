// Source connector API types — re-export shared Zod SSOT (was local parallel island).
export type {
  ConnectorDiagnostic as Diagnostic,
  SourceConnectorCapabilities,
  SourceConnectorDescriptor,
  FrontmatterSummary,
  SnapshotEntry,
  Snapshot,
  ImportScope,
  SyncCandidate,
  SyncCandidates,
  SyncCheckResult,
  SourceConnectorBinding as ConnectorBindingRead,
  ImportResultItem,
  ImportScopeApplyResponse,
} from '@crystalith/shared';
