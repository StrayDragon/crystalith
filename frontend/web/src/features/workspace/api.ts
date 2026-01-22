import type {
  ApiAnswer,
  ApiMessage,
  ApiNotebook,
  ApiOutput,
  ApiRefineBatchResponse,
  ApiSession,
  ApiSuggestionResponse,
  ApiSource,
  ApiSourceSearchResponse,
  ApiSourceDeleteResponse,
  ApiWorkspaceToolsResponse,
  OutputTypeId,
  RefineMode,
} from './types';

const DEFAULT_HEADERS: HeadersInit = {
  Accept: 'application/json',
};

/**
 * Custom error class for API requests with status code and structured details.
 */
export class ApiError extends Error {
  status: number;
  detail: string;
  statusText: string;

  constructor(status: number, detail: string, statusText: string) {
    // Create user-friendly message based on status
    let message = detail || statusText || '请求失败';

    // Try to parse JSON error detail
    if (detail) {
      try {
        const parsed = JSON.parse(detail);
        if (parsed.detail) {
          message = typeof parsed.detail === 'string' ? parsed.detail : JSON.stringify(parsed.detail);
        }
      } catch {
        // Use raw detail if not JSON
      }
    }

    // Provide user-friendly messages for common status codes
    if (!message || message === statusText) {
      switch (status) {
        case 400:
          message = '请求参数有误，请检查输入。';
          break;
        case 404:
          message = '请求的资源不存在。';
          break;
        case 422:
          message = 'AI 模型处理失败，请稍后重试。';
          break;
        case 500:
          message = '服务器内部错误，请稍后重试。';
          break;
        case 503:
          message = 'AI 服务暂时不可用，请检查配置或稍后重试。';
          break;
        default:
          message = `请求失败 (${status})`;
      }
    }

    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.detail = detail;
    this.statusText = statusText;
  }
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(path, {
    ...options,
    headers: {
      ...DEFAULT_HEADERS,
      ...(options.headers ?? {}),
    },
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    throw new ApiError(response.status, detail, response.statusText);
  }

  if (response.status === 204) {
    return null as T;
  }

  return response.json() as Promise<T>;
}

export async function listNotebooks(): Promise<ApiNotebook[]> {
  return request<ApiNotebook[]>('/v1/notebooks');
}

export async function createNotebook(name: string): Promise<ApiNotebook> {
  return request<ApiNotebook>('/v1/notebooks', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ name }),
  });
}

export async function getNotebook(notebookId: number): Promise<ApiNotebook> {
  return request<ApiNotebook>(`/v1/notebooks/${notebookId}`);
}

export async function updateNotebook(
  notebookId: number,
  data: { name?: string },
): Promise<ApiNotebook> {
  return request<ApiNotebook>(`/v1/notebooks/${notebookId}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  });
}

export async function deleteNotebook(notebookId: number): Promise<void> {
  return request<void>(`/v1/notebooks/${notebookId}`, {
    method: 'DELETE',
  });
}

export async function listSources(notebookId: number): Promise<ApiSource[]> {
  return request<ApiSource[]>(`/v1/notebooks/${notebookId}/sources`);
}

export async function deleteSources(
  notebookId: number,
  sourceIds: number[],
): Promise<ApiSourceDeleteResponse> {
  return request<ApiSourceDeleteResponse>(`/v1/notebooks/${notebookId}/sources`, {
    method: 'DELETE',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ source_ids: sourceIds }),
  });
}

export async function deleteSource(notebookId: number, sourceId: number): Promise<void> {
  return request<void>(`/v1/notebooks/${notebookId}/sources/${sourceId}`, {
    method: 'DELETE',
  });
}

export async function uploadSource(notebookId: number, file: File): Promise<ApiSource> {
  const formData = new FormData();
  formData.append('file', file);
  return request<ApiSource>(`/v1/notebooks/${notebookId}/sources`, {
    method: 'POST',
    body: formData,
  });
}

export async function searchSources(
  notebookId: number,
  payload: { query: string; engine: string; mode: string },
): Promise<ApiSourceSearchResponse> {
  return request<ApiSourceSearchResponse>(`/v1/notebooks/${notebookId}/sources/search`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });
}

export async function askQuestion(
  notebookId: number,
  question: string,
  sessionId?: number | null,
): Promise<ApiAnswer> {
  const body: { question: string; session_id?: number | null } = { question };
  if (sessionId != null) {
    body.session_id = sessionId;
  }
  return request<ApiAnswer>(`/v1/notebooks/${notebookId}/qa`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
}

export async function refinePrompt(
  notebookId: number,
  prompt: string,
  format: RefineMode,
): Promise<ApiRefineBatchResponse> {
  const body = { prompt, format };
  return request<ApiRefineBatchResponse>(`/v1/notebooks/${notebookId}/refine`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
}

export async function listSessions(notebookId: number): Promise<ApiSession[]> {
  return request<ApiSession[]>(`/v1/notebooks/${notebookId}/sessions`);
}

export async function createSession(
  notebookId: number,
  title?: string | null,
): Promise<ApiSession> {
  return request<ApiSession>(`/v1/notebooks/${notebookId}/sessions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ title }),
  });
}

export async function getSession(
  notebookId: number,
  sessionId: number,
): Promise<ApiSession> {
  return request<ApiSession>(`/v1/notebooks/${notebookId}/sessions/${sessionId}`);
}

export async function updateSession(
  notebookId: number,
  sessionId: number,
  data: { title?: string },
): Promise<ApiSession> {
  return request<ApiSession>(`/v1/notebooks/${notebookId}/sessions/${sessionId}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  });
}

export async function deleteSession(notebookId: number, sessionId: number): Promise<void> {
  return request<void>(`/v1/notebooks/${notebookId}/sessions/${sessionId}`, {
    method: 'DELETE',
  });
}

export async function listMessages(notebookId: number, sessionId: number): Promise<ApiMessage[]> {
  return request<ApiMessage[]>(`/v1/notebooks/${notebookId}/sessions/${sessionId}/messages`);
}

export async function createSessionSuggestions(
  notebookId: number,
  sessionId: number,
  payload: { count?: number; mode?: 'standard' | 'deep_dive'; seed_question?: string | null },
): Promise<ApiSuggestionResponse> {
  return request<ApiSuggestionResponse>(`/v1/notebooks/${notebookId}/sessions/${sessionId}/suggestions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });
}

export async function createNotebookSuggestions(
  notebookId: number,
  payload: { count?: number; mode?: 'standard' | 'deep_dive'; seed_question?: string | null },
): Promise<ApiSuggestionResponse> {
  return request<ApiSuggestionResponse>(`/v1/notebooks/${notebookId}/suggestions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });
}

export async function createOutput(
  notebookId: number,
  outputType: OutputTypeId,
  payload: {
    prompt?: string | null;
    chunk_ids?: number[];
    top_k?: number;
    min_score?: number;
  },
): Promise<ApiOutput> {
  return request<ApiOutput>(`/v1/notebooks/${notebookId}/outputs/${outputType}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });
}

export async function listOutputs(notebookId: number): Promise<ApiOutput[]> {
  return request<ApiOutput[]>(`/v1/notebooks/${notebookId}/outputs`);
}

export async function getOutput(notebookId: number, outputId: number): Promise<ApiOutput> {
  return request<ApiOutput>(`/v1/notebooks/${notebookId}/outputs/${outputId}`);
}

export async function listWorkspaceTools(): Promise<ApiWorkspaceToolsResponse> {
  return request<ApiWorkspaceToolsResponse>('/v1/workspace/tools');
}

export async function refineBatch(
  notebookId: number,
  prompt: string,
  formats: RefineMode[],
  chunkIds?: number[],
): Promise<ApiRefineBatchResponse> {
  const body: { prompt: string; formats: RefineMode[]; chunk_ids?: number[] } = {
    prompt,
    formats,
  };
  if (Array.isArray(chunkIds) && chunkIds.length > 0) {
    body.chunk_ids = chunkIds;
  }
  return request<ApiRefineBatchResponse>(`/v1/notebooks/${notebookId}/refine/batch`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
}

// Task API
export interface ApiTask {
  id: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  progress?: number;
  result?: unknown;
  error?: string;
  created_at?: string;
  updated_at?: string;
}

export async function getTask(taskId: string): Promise<ApiTask> {
  return request<ApiTask>(`/v1/tasks/${taskId}`);
}

export async function listNotebookTasks(notebookId: number): Promise<ApiTask[]> {
  return request<ApiTask[]>(`/v1/notebooks/${notebookId}/tasks`);
}

// Analysis API
export interface ApiAnalysis {
  notebook_id: number;
  source_count: number;
  chunk_count: number;
  session_count: number;
  output_count: number;
  topics?: string[];
  summary?: string;
  created_at?: string;
}

export async function analyzeNotebook(notebookId: number): Promise<ApiAnalysis> {
  return request<ApiAnalysis>(`/v1/notebooks/${notebookId}/analysis`);
}
