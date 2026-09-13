import type { ConnectionState } from '../../shared/types';

export type WorkspaceReadiness =
  | { kind: 'loading' }
  | { kind: 'not_connected'; connectionState: ConnectionState; error: string }
  | { kind: 'no_notebook' }
  | { kind: 'no_session'; notebookId: number }
  | { kind: 'ready'; notebookId: number };

export interface WorkspaceReadinessInput {
  connectionState: ConnectionState;
  connectionError?: string;
  notebookId: number | null;
  sourcesLoading: boolean;
  sessionsLoading: boolean;
  sessionId: number | null;
}

export function computeWorkspaceReadiness({
  connectionState,
  connectionError = '',
  notebookId,
  sourcesLoading,
  sessionsLoading,
  sessionId,
}: WorkspaceReadinessInput): WorkspaceReadiness {
  if (connectionState !== 'live') {
    return {
      kind: 'not_connected',
      connectionState,
      error: connectionError,
    };
  }

  if (!notebookId) {
    return { kind: 'no_notebook' };
  }

  if (sourcesLoading) {
    return { kind: 'loading' };
  }

  if (sessionsLoading) {
    return { kind: 'loading' };
  }

  if (!sessionId) {
    return { kind: 'no_session', notebookId };
  }

  return { kind: 'ready', notebookId };
}
