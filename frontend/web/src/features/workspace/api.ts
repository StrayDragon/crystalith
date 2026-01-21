/**
 * Workspace API - Re-exports from the generated SDK client
 *
 * This module provides a clean interface for workspace-related API calls,
 * using the auto-generated SDK from OpenAPI schema.
 */

// Re-export everything from the SDK client
export {
  // Notebooks
  listNotebooks,
  createNotebook,
  getNotebook,
  updateNotebook,
  deleteNotebook,
  // Sources
  listSources,
  uploadSource,
  deleteSource,
  deleteSources,
  searchSources,
  // Sessions
  listSessions,
  createSession,
  getSession,
  updateSession,
  deleteSession,
  // Messages
  listMessages,
  // QA
  askQuestion,
  askQuestionStream,
  // Suggestions
  createNotebookSuggestions,
  createSessionSuggestions,
  // Outputs
  createOutput,
  listOutputs,
  getOutput,
  // Refine
  refinePrompt,
  refineBatch,
  // Workspace Tools
  listWorkspaceTools,
  // Tasks
  getTask,
  listNotebookTasks,
  // Analysis
  analyzeNotebook,
  // Error class
  ApiError,
} from '../../api/client';

// Re-export types
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
  QAStreamChunkEvent,
  QAStreamDoneEvent,
  QAStreamErrorEvent,
  QAStreamEvent,
  QAStreamCallbacks,
} from '../../api/client';

// Type aliases for backward compatibility
export type ApiNotebook = import('../../api/client').NotebookRead;
export type ApiSource = import('../../api/client').SourceRead;
export type ApiSession = import('../../api/client').SessionRead;
export type ApiMessage = import('../../api/client').MessageRead;
export type ApiAnswer = import('../../api/client').QaResponse;
export type ApiSuggestionResponse = import('../../api/client').SuggestionResponse;
export type ApiOutput = import('../../api/client').OutputRead;
export type ApiWorkspaceToolsResponse = import('../../api/client').WorkspaceToolsResponse;
export type ApiTask = import('../../api/client').TaskRead;
export type ApiAnalysis = import('../../api/client').AnalysisResult;
export type ApiSourceSearchResponse = import('../../api/generated').SourceSearchResponse;
export type ApiSourceDeleteResponse = import('../../api/generated').SourceBatchDeleteResponse;
export type ApiRefineBatchResponse = import('../../api/client').RefineBatchResponse;

// Type aliases for specific fields
export type OutputTypeId = import('../../api/client').OutputType;
export type RefineMode = string; // Keep as string for flexibility
