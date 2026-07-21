// Source connector wire types — re-export shared Zod SSOT (was local parallel island).
export type {
  ConnectorDiagnostic as Diagnostic,
  SourceConnectorCapabilities,
  SourceConnectorDescriptor,
  SourceConnectorsListResponse,
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
