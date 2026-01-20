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
    const message = detail || response.statusText || '请求失败';
    const error = new Error(message) as Error & { status?: number };
    error.status = response.status;
    throw error;
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

export async function listSources(notebookId: number): Promise<ApiSource[]> {
  return request<ApiSource[]>(`/v1/notebooks/${notebookId}/sources`);
}

export async function deleteSources(
  notebookId: number,
  sourceIds: number[],
): Promise<ApiSourceDeleteResponse> {
  return request<ApiSourceDeleteResponse>(`/v1/notebooks/${notebookId}/sources/batch-delete`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ source_ids: sourceIds }),
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

export async function listMessages(sessionId: number): Promise<ApiMessage[]> {
  return request<ApiMessage[]>(`/v1/sessions/${sessionId}/messages`);
}

export async function createSessionSuggestions(
  sessionId: number,
  payload: { count?: number; mode?: 'standard' | 'deep_dive'; seed_question?: string | null },
): Promise<ApiSuggestionResponse> {
  return request<ApiSuggestionResponse>(`/v1/sessions/${sessionId}/suggestions`, {
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
