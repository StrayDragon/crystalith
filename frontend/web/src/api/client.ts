/**
 * API Client - Wrapper around generated SDK for cleaner usage
 */
import { client } from './generated/client.gen';
import {
  listNotebooksV1NotebooksGet,
  createNotebookV1NotebooksPost,
  getNotebookV1NotebooksNotebookIdGet,
  updateNotebookV1NotebooksNotebookIdPatch,
  deleteNotebookV1NotebooksNotebookIdDelete,
  listSourcesV1NotebooksNotebookIdSourcesGet,
  uploadSourceV1NotebooksNotebookIdSourcesPost,
  deleteSourceV1NotebooksNotebookIdSourcesSourceIdDelete,
  batchDeleteSourcesV1NotebooksNotebookIdSourcesDelete,
  searchSourcesV1NotebooksNotebookIdSourcesSearchPost,
  listSessionsV1NotebooksNotebookIdSessionsGet,
  createSessionV1NotebooksNotebookIdSessionsPost,
  getSessionV1NotebooksNotebookIdSessionsSessionIdGet,
  updateSessionV1NotebooksNotebookIdSessionsSessionIdPatch,
  deleteSessionV1NotebooksNotebookIdSessionsSessionIdDelete,
  listMessagesV1NotebooksNotebookIdSessionsSessionIdMessagesGet,
  askQuestionV1NotebooksNotebookIdQaPost,
  askQuestionStreamV1NotebooksNotebookIdQaStreamPost,
  notebookSuggestionsV1NotebooksNotebookIdSuggestionsPost,
  sessionSuggestionsV1NotebooksNotebookIdSessionsSessionIdSuggestionsPost,
  createOutputV1NotebooksNotebookIdOutputsOutputTypePost,
  listOutputsV1NotebooksNotebookIdOutputsGet,
  getOutputV1NotebooksNotebookIdOutputsOutputIdGet,
  refineV1NotebooksNotebookIdRefinePost,
  refineBatchV1NotebooksNotebookIdRefineBatchPost,
  listWorkspaceToolsV1WorkspaceToolsGet,
  getTaskV1TasksTaskIdGet,
  listTasksV1NotebooksNotebookIdTasksGet,
  analyzeNotebookV1NotebooksNotebookIdAnalysisGet,
} from './generated';

import type {
  NotebookRead,
  NotebookCreate,
  NotebookUpdate,
  SourceRead,
  SourceSearchResponse,
  SessionRead,
  SessionCreate,
  SessionUpdate,
  MessageRead,
  QaResponse,
  SuggestionResponse,
  OutputRead,
  OutputType,
  RefineResponse,
  RefineBatchResponse,
  WorkspaceToolsResponse,
  TaskRead,
  AnalysisResult,
  Citation,
  ContextStatsResponse,
} from './generated';

// Re-export types for convenience
export type {
  NotebookRead,
  SourceRead,
  SessionRead,
  MessageRead,
  QaResponse,
  SuggestionResponse,
  OutputRead,
  OutputType,
  RefineResponse,
  RefineBatchResponse,
  WorkspaceToolsResponse,
  TaskRead,
  AnalysisResult,
  Citation,
  ContextStatsResponse,
};

// Configure client base URL (empty string uses relative URLs)
client.setConfig({ baseUrl: '' });

// Error handling helper
class ApiError extends Error {
  status: number;
  detail: string;

  constructor(status: number, detail: string) {
    super(detail || `API Error: ${status}`);
    this.name = 'ApiError';
    this.status = status;
    this.detail = detail;
  }
}

function handleResponse<T>(result: { data?: T; error?: unknown }): T {
  if (result.error) {
    const err = result.error as { status?: number; detail?: string };
    throw new ApiError(err.status || 500, err.detail || 'Unknown error');
  }
  return result.data as T;
}

// Notebooks
export async function listNotebooks(): Promise<NotebookRead[]> {
  const result = await listNotebooksV1NotebooksGet();
  return handleResponse(result);
}

export async function createNotebook(name: string): Promise<NotebookRead> {
  const result = await createNotebookV1NotebooksPost({
    body: { name } as NotebookCreate,
  });
  return handleResponse(result);
}

export async function getNotebook(notebookId: number): Promise<NotebookRead> {
  const result = await getNotebookV1NotebooksNotebookIdGet({
    path: { notebook_id: notebookId },
  });
  return handleResponse(result);
}

export async function updateNotebook(
  notebookId: number,
  data: NotebookUpdate,
): Promise<NotebookRead> {
  const result = await updateNotebookV1NotebooksNotebookIdPatch({
    path: { notebook_id: notebookId },
    body: data,
  });
  return handleResponse(result);
}

export async function deleteNotebook(notebookId: number): Promise<void> {
  const result = await deleteNotebookV1NotebooksNotebookIdDelete({
    path: { notebook_id: notebookId },
  });
  handleResponse(result);
}

// Sources
export async function listSources(notebookId: number): Promise<SourceRead[]> {
  const result = await listSourcesV1NotebooksNotebookIdSourcesGet({
    path: { notebook_id: notebookId },
  });
  return handleResponse(result);
}

export async function uploadSource(notebookId: number, file: File): Promise<SourceRead> {
  const result = await uploadSourceV1NotebooksNotebookIdSourcesPost({
    path: { notebook_id: notebookId },
    body: { file },
  });
  return handleResponse(result);
}

export async function deleteSource(notebookId: number, sourceId: number): Promise<void> {
  const result = await deleteSourceV1NotebooksNotebookIdSourcesSourceIdDelete({
    path: { notebook_id: notebookId, source_id: sourceId },
  });
  handleResponse(result);
}

export async function deleteSources(
  notebookId: number,
  sourceIds: number[],
): Promise<{ deleted_count: number }> {
  const result = await batchDeleteSourcesV1NotebooksNotebookIdSourcesDelete({
    path: { notebook_id: notebookId },
    body: { source_ids: sourceIds },
  });
  return handleResponse(result);
}

export async function searchSources(
  notebookId: number,
  payload: { query: string; engine: string; mode: string },
): Promise<SourceSearchResponse> {
  const result = await searchSourcesV1NotebooksNotebookIdSourcesSearchPost({
    path: { notebook_id: notebookId },
    body: payload,
  });
  return handleResponse(result);
}

// Sessions
export async function listSessions(notebookId: number): Promise<SessionRead[]> {
  const result = await listSessionsV1NotebooksNotebookIdSessionsGet({
    path: { notebook_id: notebookId },
  });
  return handleResponse(result);
}

export async function createSession(
  notebookId: number,
  title?: string | null,
): Promise<SessionRead> {
  const result = await createSessionV1NotebooksNotebookIdSessionsPost({
    path: { notebook_id: notebookId },
    body: { title } as SessionCreate,
  });
  return handleResponse(result);
}

export async function getSession(notebookId: number, sessionId: number): Promise<SessionRead> {
  const result = await getSessionV1NotebooksNotebookIdSessionsSessionIdGet({
    path: { notebook_id: notebookId, session_id: sessionId },
  });
  return handleResponse(result);
}

export async function updateSession(
  notebookId: number,
  sessionId: number,
  data: SessionUpdate,
): Promise<SessionRead> {
  const result = await updateSessionV1NotebooksNotebookIdSessionsSessionIdPatch({
    path: { notebook_id: notebookId, session_id: sessionId },
    body: data,
  });
  return handleResponse(result);
}

export async function deleteSession(notebookId: number, sessionId: number): Promise<void> {
  const result = await deleteSessionV1NotebooksNotebookIdSessionsSessionIdDelete({
    path: { notebook_id: notebookId, session_id: sessionId },
  });
  handleResponse(result);
}

// Messages
export async function listMessages(notebookId: number, sessionId: number): Promise<MessageRead[]> {
  const result = await listMessagesV1NotebooksNotebookIdSessionsSessionIdMessagesGet({
    path: { notebook_id: notebookId, session_id: sessionId },
  });
  return handleResponse(result);
}

// QA
export async function askQuestion(
  notebookId: number,
  question: string,
  sessionId?: number | null,
): Promise<QaResponse> {
  const result = await askQuestionV1NotebooksNotebookIdQaPost({
    path: { notebook_id: notebookId },
    body: {
      question,
      session_id: sessionId ?? undefined,
    },
  });
  return handleResponse(result);
}

// QA Stream types
export interface QAStreamChunkEvent {
  type: 'chunk';
  text: string;
}

export interface QAStreamDoneEvent {
  type: 'done';
  citations: Citation[];
  evidence: boolean;
  confidence: number;
  created_at: string;
  context: ContextStatsResponse;
}

export interface QAStreamErrorEvent {
  type: 'error';
  message: string;
}

export type QAStreamEvent = QAStreamChunkEvent | QAStreamDoneEvent | QAStreamErrorEvent;

export interface QAStreamCallbacks {
  onChunk?: (text: string) => void;
  onDone?: (data: Omit<QAStreamDoneEvent, 'type'>) => void;
  onError?: (message: string) => void;
}

/**
 * Stream QA response using Server-Sent Events.
 */
export async function askQuestionStream(
  notebookId: number,
  question: string,
  sessionId?: number | null,
  callbacks?: QAStreamCallbacks,
): Promise<{ fullAnswer: string; done: QAStreamDoneEvent | null }> {
  const response = await fetch(`/v1/notebooks/${notebookId}/qa/stream`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'text/event-stream',
    },
    body: JSON.stringify({
      question,
      session_id: sessionId ?? undefined,
    }),
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    throw new ApiError(response.status, detail);
  }

  const reader = response.body?.getReader();
  if (!reader) {
    throw new Error('Response body is not readable');
  }

  const decoder = new TextDecoder();
  let buffer = '';
  let fullAnswer = '';
  let doneEvent: QAStreamDoneEvent | null = null;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      let currentEventType = '';
      let currentData = '';

      for (const line of lines) {
        if (line.startsWith('event: ')) {
          currentEventType = line.slice(7).trim();
        } else if (line.startsWith('data: ')) {
          currentData = line.slice(6);
        } else if (line === '' && currentEventType && currentData) {
          try {
            const parsed = JSON.parse(currentData);
            if (currentEventType === 'chunk') {
              fullAnswer += parsed.text;
              callbacks?.onChunk?.(parsed.text);
            } else if (currentEventType === 'done') {
              doneEvent = { type: 'done', ...parsed };
              callbacks?.onDone?.(parsed);
            } else if (currentEventType === 'error') {
              callbacks?.onError?.(parsed.message);
            }
          } catch {
            // Ignore parse errors
          }
          currentEventType = '';
          currentData = '';
        }
      }
    }
  } finally {
    reader.releaseLock();
  }

  return { fullAnswer, done: doneEvent };
}

// Suggestions
export async function createNotebookSuggestions(
  notebookId: number,
  payload: { count?: number; mode?: 'standard' | 'deep_dive'; seed_question?: string | null },
): Promise<SuggestionResponse> {
  const result = await notebookSuggestionsV1NotebooksNotebookIdSuggestionsPost({
    path: { notebook_id: notebookId },
    body: payload,
  });
  return handleResponse(result);
}

export async function createSessionSuggestions(
  notebookId: number,
  sessionId: number,
  payload: { count?: number; mode?: 'standard' | 'deep_dive'; seed_question?: string | null },
): Promise<SuggestionResponse> {
  const result = await sessionSuggestionsV1NotebooksNotebookIdSessionsSessionIdSuggestionsPost({
    path: { notebook_id: notebookId, session_id: sessionId },
    body: payload,
  });
  return handleResponse(result);
}

// Outputs
export async function createOutput(
  notebookId: number,
  outputType: OutputType,
  payload: {
    prompt?: string | null;
    chunk_ids?: number[];
    top_k?: number;
    min_score?: number;
  },
): Promise<OutputRead> {
  const result = await createOutputV1NotebooksNotebookIdOutputsOutputTypePost({
    path: { notebook_id: notebookId, output_type: outputType },
    body: payload,
  });
  return handleResponse(result);
}

export async function listOutputs(notebookId: number): Promise<OutputRead[]> {
  const result = await listOutputsV1NotebooksNotebookIdOutputsGet({
    path: { notebook_id: notebookId },
  });
  return handleResponse(result);
}

export async function getOutput(notebookId: number, outputId: number): Promise<OutputRead> {
  const result = await getOutputV1NotebooksNotebookIdOutputsOutputIdGet({
    path: { notebook_id: notebookId, output_id: outputId },
  });
  return handleResponse(result);
}

// Refine
export async function refinePrompt(
  notebookId: number,
  prompt: string,
  format: string,
): Promise<RefineResponse> {
  const result = await refineV1NotebooksNotebookIdRefinePost({
    path: { notebook_id: notebookId },
    body: { prompt, format },
  });
  return handleResponse(result);
}

export async function refineBatch(
  notebookId: number,
  prompt: string,
  formats: string[],
  chunkIds?: number[],
): Promise<RefineBatchResponse> {
  const result = await refineBatchV1NotebooksNotebookIdRefineBatchPost({
    path: { notebook_id: notebookId },
    body: {
      prompt,
      formats,
      chunk_ids: chunkIds,
    },
  });
  return handleResponse(result);
}

// Workspace Tools
export async function listWorkspaceTools(): Promise<WorkspaceToolsResponse> {
  const result = await listWorkspaceToolsV1WorkspaceToolsGet();
  return handleResponse(result);
}

// Tasks
export async function getTask(taskId: string): Promise<TaskRead> {
  const result = await getTaskV1TasksTaskIdGet({
    path: { task_id: taskId },
  });
  return handleResponse(result);
}

export async function listNotebookTasks(notebookId: number): Promise<TaskRead[]> {
  const result = await listTasksV1NotebooksNotebookIdTasksGet({
    path: { notebook_id: notebookId },
  });
  return handleResponse(result);
}

// Analysis
export async function analyzeNotebook(notebookId: number): Promise<AnalysisResult> {
  const result = await analyzeNotebookV1NotebooksNotebookIdAnalysisGet({
    path: { notebook_id: notebookId },
  });
  return handleResponse(result);
}

// Export ApiError for use in other modules
export { ApiError };
