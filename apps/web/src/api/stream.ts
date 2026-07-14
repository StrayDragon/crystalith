/**
 * SSE Streaming Adapter for Eden Treaty v2
 *
 * Eden treaty doesn't natively support SSE/streaming endpoints.
 * This adapter provides `fetch()`-based SSE consumption for streaming
 * endpoints like /v2/qa/stream, /v2/research/:id/stream, etc.
 *
 * Usage:
 *   const stream = streamRequest('/v2/qa/stream', { method: 'POST', body: {...} });
 *   for await (const event of stream) { ... }
 */

export interface SseEvent {
  event: string;
  data: unknown;
}

/** Parse a single SSE `data: {...}` line into an SseEvent. */
function parseSseLine(line: string): SseEvent | null {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith(':')) return null;

  let eventName = 'message';
  let eventData = '';

  if (trimmed.startsWith('event: ')) {
    eventName = trimmed.slice(7).trim();
    return { event: eventName, data: null };
  }

  if (trimmed.startsWith('data: ')) {
    eventData = trimmed.slice(6);
    try {
      return { event: eventName, data: JSON.parse(eventData) };
    } catch {
      return { event: eventName, data: eventData };
    }
  }

  // Handle id: and retry: lines — ignore for now
  if (trimmed.startsWith('id: ') || trimmed.startsWith('retry: ')) {
    return null;
  }

  // Unknown format — treat as data
  return { event: eventName, data: trimmed };
}

function getBaseUrl(): string {
  if (typeof window !== 'undefined') {
    // Browser: use same origin (Vite proxy handles forwarding in dev)
    return window.location.origin;
  }
  // Server-side or env override
  return (
    (import.meta as unknown as { env?: Record<string, string> }).env?.VITE_API_BASE_URL ??
    'http://localhost:8032'
  );
}

const BASE_URL = getBaseUrl();

export interface StreamRequestOptions {
  method?: string;
  body?: unknown;
  headers?: Record<string, string>;
  signal?: AbortSignal;
}

export async function* streamRequest(
  path: string,
  options: StreamRequestOptions = {},
): AsyncGenerator<SseEvent> {
  const url = `${BASE_URL}${path}`;
  const headers: Record<string, string> = {
    Accept: 'text/event-stream',
    ...options.headers,
  };

  if (options.body !== undefined) {
    headers['Content-Type'] = 'application/json';
  }

  const response = await fetch(url, {
    method: options.method ?? 'GET',
    headers,
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
    signal: options.signal,
  });

  if (!response.ok) {
    const error: Error & { status?: number } = new Error(
      `SSE request failed: ${response.status} ${response.statusText}`,
    );
    error.status = response.status;
    throw error;
  }

  const reader = response.body?.getReader();
  if (!reader) throw new Error('Response body is not readable');

  const decoder = new TextDecoder();
  let buffer = '';

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      // Keep last incomplete line in buffer
      buffer = lines.pop() ?? '';

      for (const line of lines) {
        const event = parseSseLine(line);
        if (event) yield event;
      }
    }

    // Process remaining buffer
    if (buffer.trim()) {
      const event = parseSseLine(buffer);
      if (event) yield event;
    }
  } finally {
    reader.releaseLock();
  }
}
