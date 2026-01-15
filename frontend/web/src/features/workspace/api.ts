import type {
  ApiAnswer,
  ApiNotebook,
  ApiRefineBatchResponse,
  ApiSource,
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

export async function uploadSource(notebookId: number, file: File): Promise<ApiSource> {
  const formData = new FormData();
  formData.append('file', file);
  return request<ApiSource>(`/v1/notebooks/${notebookId}/sources`, {
    method: 'POST',
    body: formData,
  });
}

export async function askQuestion(
  notebookId: number,
  question: string,
): Promise<ApiAnswer> {
  return request<ApiAnswer>(`/v1/notebooks/${notebookId}/qa`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ question }),
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
