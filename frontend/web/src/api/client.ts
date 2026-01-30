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
  listSourceChunksV1NotebooksNotebookIdSourcesSourceIdChunksGet,
  getSourceSummaryV1NotebooksNotebookIdSourcesSourceIdSummaryGet,
  sourceQaV1NotebooksNotebookIdSourcesSourceIdQaPost,
  convertSourceQaToSourceV1NotebooksNotebookIdSourcesSourceIdQaConvertToSourcePost,
  listSessionsV1NotebooksNotebookIdSessionsGet,
  createSessionV1NotebooksNotebookIdSessionsPost,
  getSessionV1NotebooksNotebookIdSessionsSessionIdGet,
  updateSessionV1NotebooksNotebookIdSessionsSessionIdPatch,
  deleteSessionV1NotebooksNotebookIdSessionsSessionIdDelete,
  listMessagesV1NotebooksNotebookIdSessionsSessionIdMessagesGet,
  askQuestionV1NotebooksNotebookIdQaPost,
  askQuestionStreamV1NotebooksNotebookIdQaStreamPost,
  createOutputV1NotebooksNotebookIdOutputsOutputTypePost,
  listOutputsV1NotebooksNotebookIdOutputsGet,
  getOutputV1NotebooksNotebookIdOutputsOutputIdGet,
  refineV1NotebooksNotebookIdRefinePost,
  refineBatchV1NotebooksNotebookIdRefineBatchPost,
  listWorkspaceToolsV1WorkspaceToolsGet,
  getSlidesConfigV1WorkspaceToolsSlidesConfigGet,
  getLatestDraftV1NotebooksNotebookIdSlidesDraftsLatestGet,
  createDraftV1NotebooksNotebookIdSlidesDraftsPost,
  getDraftV1NotebooksNotebookIdSlidesDraftsSlideIdGet,
  updateDraftV1NotebooksNotebookIdSlidesDraftsSlideIdPatch,
  updateOutlineV1NotebooksNotebookIdSlidesDraftsSlideIdOutlinePut,
  updateMarkdownV1NotebooksNotebookIdSlidesDraftsSlideIdMarkdownPut,
  getTaskV1TasksTaskIdGet,
  listTasksV1NotebooksNotebookIdTasksGet,
  analyzeNotebookV1NotebooksNotebookIdAnalysisGet,
  // Research API functions
  createResearchSessionV1NotebooksNotebookIdResearchPost,
  listResearchSessionsV1NotebooksNotebookIdResearchGet,
  getResearchSessionV1NotebooksNotebookIdResearchResearchIdGet,
  deleteResearchSessionV1NotebooksNotebookIdResearchResearchIdDelete,
  startResearchV1NotebooksNotebookIdResearchResearchIdStartPost,
  approveSearchPlanV1NotebooksNotebookIdResearchResearchIdApprovePost,
  modifySearchPlanV1NotebooksNotebookIdResearchResearchIdModifyPost,
  skipIterationV1NotebooksNotebookIdResearchResearchIdSkipPost,
  finishResearchV1NotebooksNotebookIdResearchResearchIdFinishPost,
  cancelResearchV1NotebooksNotebookIdResearchResearchIdCancelPost,
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
  OutputRead,
  OutputType,
  RefineResponse,
  RefineBatchResponse,
  WorkspaceToolsResponse,
  TaskRead,
  AnalysisResult,
  Citation,
  ContextStatsResponse,
  ChunkRead,
  SourceSummaryResponse,
  SourceQaResponse,
  QaMessage,
  ConvertSourceQaToSourceResponse,
  SlideDraftCreate,
  SlideDraftRead,
  SlideDraftUpdate,
  SlidesConfigResponse,
  SlideOutlineUpdate,
  SlideMarkdownUpdate,
} from './generated';

// Re-export types for convenience
export type {
  NotebookRead,
  SourceRead,
  SessionRead,
  MessageRead,
  QaResponse,
  OutputRead,
  OutputType,
  RefineResponse,
  RefineBatchResponse,
  WorkspaceToolsResponse,
  TaskRead,
  AnalysisResult,
  Citation,
  ContextStatsResponse,
  SlideDraftRead,
  SlidesConfigResponse,
  SlideOutlineUpdate,
  SlideMarkdownUpdate,
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

// Add source from URL (not yet in generated SDK)
export type SourceFromUrlMode = 'fetch' | 'link';
export type ExtractorType = 'trafilatura' | 'firecrawl' | 'browserless';

export interface AddSourceFromUrlPayload {
  url: string;
  title?: string;
  snippet?: string;
  mode: SourceFromUrlMode;
  extractor?: ExtractorType;
}

export async function addSourceFromUrl(
  notebookId: number,
  payload: AddSourceFromUrlPayload,
): Promise<SourceRead> {
  const response = await fetch(`/v1/notebooks/${notebookId}/sources/from-url`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new ApiError(response.status, err.detail || 'Failed to add source from URL');
  }
  return response.json();
}

// Extractors API
export interface ExtractorInfo {
  type: ExtractorType;
  enabled: boolean;
  available: boolean;
  display_name: string;
  description: string;
  priority: number;
  requires_api_key: boolean;
  requires_service: boolean;
}

export interface ExtractorsListResponse {
  extractors: ExtractorInfo[];
  default_extractor: ExtractorType | null;
  fallback_enabled: boolean;
}

/**
 * List available web content extractors for a notebook.
 */
export async function listExtractors(notebookId: number): Promise<ExtractorsListResponse> {
  const response = await fetch(`/v1/notebooks/${notebookId}/sources/extractors`);
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new ApiError(response.status, err.detail || 'Failed to list extractors');
  }
  return response.json();
}

// Re-export SDK types for Source Summary, QA, and Chunks
export type { SourceSummaryResponse, SourceQaResponse, QaMessage, ConvertSourceQaToSourceResponse, ChunkRead };

// Type aliases for backward compatibility
export type SourceQAResponse = SourceQaResponse;
export type QAMessage = QaMessage;
export type ConvertSourceQAToSourceResponse = ConvertSourceQaToSourceResponse;

/**
 * Get source summary.
 * @param notebookId - Notebook ID
 * @param sourceId - Source ID
 */
export async function getSourceSummary(
  notebookId: number,
  sourceId: number,
): Promise<SourceSummaryResponse> {
  const result = await getSourceSummaryV1NotebooksNotebookIdSourcesSourceIdSummaryGet({
    path: { notebook_id: notebookId, source_id: sourceId },
  });
  return handleResponse(result);
}

/**
 * Ask a question based on a specific source's content.
 * @param notebookId - Notebook ID
 * @param sourceId - Source ID
 * @param question - Question to ask
 */
export async function askSourceQuestion(
  notebookId: number,
  sourceId: number,
  question: string,
): Promise<SourceQaResponse> {
  const result = await sourceQaV1NotebooksNotebookIdSourcesSourceIdQaPost({
    path: { notebook_id: notebookId, source_id: sourceId },
    body: { question },
  });
  return handleResponse(result);
}

/**
 * Convert source QA conversation to a new source document for RAG queries.
 * @param notebookId - Notebook ID
 * @param sourceId - Original source ID
 * @param messages - QA conversation messages
 */
export async function convertSourceQAToSource(
  notebookId: number,
  sourceId: number,
  messages: QaMessage[],
): Promise<ConvertSourceQaToSourceResponse> {
  const result = await convertSourceQaToSourceV1NotebooksNotebookIdSourcesSourceIdQaConvertToSourcePost({
    path: { notebook_id: notebookId, source_id: sourceId },
    body: { messages },
  });
  return handleResponse(result);
}

/**
 * List all chunks for a specific source.
 * @param notebookId - Notebook ID
 * @param sourceId - Source ID
 */
export async function listSourceChunks(
  notebookId: number,
  sourceId: number,
): Promise<ChunkRead[]> {
  const result = await listSourceChunksV1NotebooksNotebookIdSourcesSourceIdChunksGet({
    path: { notebook_id: notebookId, source_id: sourceId },
  });
  return handleResponse(result);
}

/**
 * Re-embed a failed source using existing chunks.
 * @param notebookId - Notebook ID
 * @param sourceId - Source ID
 */
export async function reembedSource(
  notebookId: number,
  sourceId: number,
): Promise<SourceRead> {
  const response = await fetch(
    `/v1/notebooks/${notebookId}/sources/${sourceId}/re-embed`,
    { method: 'POST' },
  );
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new ApiError(response.status, err.detail || 'Failed to re-embed source');
  }
  return response.json();
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

// Session Conversion

export interface ConvertSessionToSourceRequest {
  message_ids?: number[] | null;
}

export interface ConvertSessionToSourceResponse {
  source_id: number;
  filename: string;
  chunk_count: number;
}

export interface ConvertSessionToOutputRequest {
  message_ids?: number[] | null;
  output_type: OutputType;
}

export interface ConvertSessionToOutputResponse {
  output_id: number;
  output_type: string;
  title: string;
}

/**
 * Convert session messages to a source document for RAG queries.
 * @param notebookId - Notebook ID
 * @param sessionId - Session ID
 * @param messageIds - Optional specific message IDs to convert. If null, converts entire session.
 */
export async function convertSessionToSource(
  notebookId: number,
  sessionId: number,
  messageIds?: number[] | null,
): Promise<ConvertSessionToSourceResponse> {
  const response = await fetch(
    `/v1/notebooks/${notebookId}/sessions/${sessionId}/convert-to-source`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message_ids: messageIds ?? null }),
    },
  );
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new ApiError(response.status, err.detail || 'Failed to convert session to source');
  }
  return response.json();
}

/**
 * Convert session messages to a studio output/note.
 * @param notebookId - Notebook ID
 * @param sessionId - Session ID
 * @param outputType - Type of output to create (PARAGRAPH, BULLETS, STRUCTURED)
 * @param messageIds - Optional specific message IDs to convert. If null, converts entire session.
 */
export async function convertSessionToOutput(
  notebookId: number,
  sessionId: number,
  outputType: OutputType,
  messageIds?: number[] | null,
): Promise<ConvertSessionToOutputResponse> {
  const response = await fetch(
    `/v1/notebooks/${notebookId}/sessions/${sessionId}/convert-to-output`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message_ids: messageIds ?? null,
        output_type: outputType,
      }),
    },
  );
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new ApiError(response.status, err.detail || 'Failed to convert session to output');
  }
  return response.json();
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
  chunkIds?: number[],
  sourceIds?: number[],
): Promise<QaResponse> {
  const result = await askQuestionV1NotebooksNotebookIdQaPost({
    path: { notebook_id: notebookId },
    body: {
      question,
      session_id: sessionId ?? undefined,
      chunk_ids: chunkIds && chunkIds.length ? chunkIds : undefined,
      source_ids: sourceIds && sourceIds.length ? sourceIds : undefined,
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
  chunkIds?: number[],
  sourceIds?: number[],
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
      chunk_ids: chunkIds && chunkIds.length ? chunkIds : undefined,
      source_ids: sourceIds && sourceIds.length ? sourceIds : undefined,
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

// Outputs
export async function createOutput(
  notebookId: number,
  outputType: OutputType,
  payload: {
    prompt?: string | null;
    chunk_ids?: number[];
    source_ids?: number[];
    top_k?: number;
    min_score?: number;
    model_id?: string | null;
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

export async function deleteOutput(notebookId: number, outputId: number): Promise<void> {
  const response = await fetch(`/v1/notebooks/${notebookId}/outputs/${outputId}`, {
    method: 'DELETE',
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new ApiError(response.status, err.detail || 'Failed to delete output');
  }
}

export interface ConvertToSourceResponse {
  source_id: number;
  filename: string;
  chunk_count: number;
}

export async function convertOutputToSource(
  notebookId: number,
  outputId: number,
): Promise<ConvertToSourceResponse> {
  const response = await fetch(`/v1/notebooks/${notebookId}/outputs/${outputId}/convert-to-source`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new ApiError(response.status, err.detail || 'Failed to convert output to source');
  }
  return response.json();
}

// Slides
export async function getLatestSlidesDraft(notebookId: number): Promise<SlideDraftRead> {
  const result = await getLatestDraftV1NotebooksNotebookIdSlidesDraftsLatestGet({
    path: { notebook_id: notebookId },
  });
  return handleResponse(result);
}

export async function createSlidesDraft(
  notebookId: number,
  payload: SlideDraftCreate,
): Promise<SlideDraftRead> {
  const result = await createDraftV1NotebooksNotebookIdSlidesDraftsPost({
    path: { notebook_id: notebookId },
    body: payload,
  });
  return handleResponse(result);
}

export async function getSlidesDraft(
  notebookId: number,
  slideId: number,
): Promise<SlideDraftRead> {
  const result = await getDraftV1NotebooksNotebookIdSlidesDraftsSlideIdGet({
    path: { notebook_id: notebookId, slide_id: slideId },
  });
  return handleResponse(result);
}

export async function updateSlidesDraft(
  notebookId: number,
  slideId: number,
  payload: SlideDraftUpdate,
): Promise<SlideDraftRead> {
  const result = await updateDraftV1NotebooksNotebookIdSlidesDraftsSlideIdPatch({
    path: { notebook_id: notebookId, slide_id: slideId },
    body: payload,
  });
  return handleResponse(result);
}

export async function updateSlidesOutline(
  notebookId: number,
  slideId: number,
  payload: SlideOutlineUpdate,
): Promise<SlideDraftRead> {
  const result = await updateOutlineV1NotebooksNotebookIdSlidesDraftsSlideIdOutlinePut({
    path: { notebook_id: notebookId, slide_id: slideId },
    body: payload,
  });
  return handleResponse(result);
}

export async function updateSlidesMarkdown(
  notebookId: number,
  slideId: number,
  payload: SlideMarkdownUpdate,
): Promise<SlideDraftRead> {
  const result = await updateMarkdownV1NotebooksNotebookIdSlidesDraftsSlideIdMarkdownPut({
    path: { notebook_id: notebookId, slide_id: slideId },
    body: payload,
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
  sourceIds?: number[],
): Promise<RefineBatchResponse> {
  const result = await refineBatchV1NotebooksNotebookIdRefineBatchPost({
    path: { notebook_id: notebookId },
    body: {
      prompt,
      formats,
      chunk_ids: chunkIds,
      source_ids: sourceIds,
    },
  });
  return handleResponse(result);
}

// Workspace Tools
export async function listWorkspaceTools(): Promise<WorkspaceToolsResponse> {
  const result = await listWorkspaceToolsV1WorkspaceToolsGet();
  return handleResponse(result);
}

export async function getSlidesConfig(): Promise<SlidesConfigResponse> {
  const result = await getSlidesConfigV1WorkspaceToolsSlidesConfigGet();
  return handleResponse(result);
}

// Tool Configuration (manual fetch wrapper)
export interface ToolConfigOption {
  id: string;
  label: string;
  is_default: boolean;
}

export interface ToolConfigResponse {
  tool_id: string;
  tool_label: string;
  quantity_options: ToolConfigOption[] | null;
  difficulty_options: ToolConfigOption[] | null;
  topic_placeholder: string | null;
  supports_topic: boolean;
}

export async function getToolConfig(toolId: string): Promise<ToolConfigResponse> {
  const response = await fetch(`/v1/workspace/tools/${toolId}/config`);
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new ApiError(response.status, err.detail || 'Failed to get tool config');
  }
  return response.json();
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

// Models API

export interface ModelRead {
  id: string;
  provider: 'openai' | 'ollama';
  model: string;
  display_name: string;
  description: string;
  capabilities: Array<'chat' | 'embedding'>;
}

export interface ModelsListResponse {
  models: ModelRead[];
  default_chat: string | null;
  default_embedding: string | null;
}

/**
 * List all available AI models.
 * @param capability - Optional filter by capability ('chat' or 'embedding')
 */
export async function listModels(capability?: 'chat' | 'embedding'): Promise<ModelsListResponse> {
  const url = capability ? `/v1/models?capability=${capability}` : '/v1/models';
  const response = await fetch(url);
  if (!response.ok) {
    throw new ApiError(response.status, `Failed to list models: ${response.statusText}`);
  }
  return response.json();
}

/**
 * Get a specific model by ID.
 */
export async function getModel(modelId: string): Promise<ModelRead> {
  const response = await fetch(`/v1/models/${encodeURIComponent(modelId)}`);
  if (!response.ok) {
    throw new ApiError(response.status, `Failed to get model: ${response.statusText}`);
  }
  return response.json();
}

// Export ApiError for use in other modules
export { ApiError };

// Re-export research API functions
export {
  createResearchSessionV1NotebooksNotebookIdResearchPost,
  listResearchSessionsV1NotebooksNotebookIdResearchGet,
  getResearchSessionV1NotebooksNotebookIdResearchResearchIdGet,
  deleteResearchSessionV1NotebooksNotebookIdResearchResearchIdDelete,
  startResearchV1NotebooksNotebookIdResearchResearchIdStartPost,
  approveSearchPlanV1NotebooksNotebookIdResearchResearchIdApprovePost,
  modifySearchPlanV1NotebooksNotebookIdResearchResearchIdModifyPost,
  skipIterationV1NotebooksNotebookIdResearchResearchIdSkipPost,
  finishResearchV1NotebooksNotebookIdResearchResearchIdFinishPost,
  cancelResearchV1NotebooksNotebookIdResearchResearchIdCancelPost,
};

// Re-export research types
export type {
  ResearchSessionCreate,
  ResearchSessionListItem,
  ResearchSessionResponse,
  ResearchStepResponse,
  ResearchStatus,
  ResearchStepType,
  ResearchStepStatus,
} from './generated';
