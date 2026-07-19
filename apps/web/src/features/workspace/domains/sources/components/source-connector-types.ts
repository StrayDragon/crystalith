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

/** @deprecated Prefer Record<string, unknown> / JsonMetadata from shared. */
export type JsonValueInput =
  | string
  | number
  | boolean
  | null
  | JsonValueInput[]
  | {
      [key: string]: JsonValueInput;
    };

/** @deprecated Prefer JsonMetadata from shared. */
export type JsonDictInput = Record<string, JsonValueInput>;
