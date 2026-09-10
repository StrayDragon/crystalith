/**
 * SSE Streaming Adapter for Eden Treaty v2
 *
 * Eden treaty doesn't natively support SSE/streaming endpoints.
 * This adapter provides `fetch()`-based SSE consumption.
 *
 * Verb convention (c70):
 *   - QA interactive generation → POST + JSON body
 *   - Research / studio progress on existing resources → GET (default)
 *
 * Usage:
 *   const stream = streamRequest(`/v2/notebooks/${nid}/qa/stream`, { method: 'POST', body: {...} });
 *   const progress = streamRequest(`/v2/notebooks/${nid}/research/${id}/stream`); // GET
 *   for await (const event of stream) { ... }
 */

import { resolveApiBaseUrl } from './apiEnv';

export interface SseEvent {
  event: string;
  data: unknown;
}

/**
 * Parse a complete SSE event block (one or more lines ending at a blank line).
 * Spec: `event:` sets the name; one or more `data:` lines are joined with `\n`.
 */
export function parseSseBlock(block: string): SseEvent | null {
  const lines = block.split('\n');
  let eventName = 'message';
  const dataLines: string[] = [];

  for (const raw of lines) {
    const line = raw.replace(/\r$/u, '');
    if (!line || line.startsWith(':')) continue;

    if (line.startsWith('event:')) {
      eventName = line.slice(6).trimStart();
      continue;
    }

    if (line.startsWith('data:')) {
      // Spec allows optional single space after the colon
      dataLines.push(line.startsWith('data: ') ? line.slice(6) : line.slice(5));
      continue;
    }

    // id: / retry: — ignore
  }

  if (dataLines.length === 0) return null;

  const rawData = dataLines.join('\n');
  try {
    return { event: eventName, data: JSON.parse(rawData) };
  } catch {
    return { event: eventName, data: rawData };
  }
}

function getBaseUrl(): string {
  if (typeof window !== 'undefined') {
    // Browser: use same origin (dev-server proxy handles forwarding)
    return window.location.origin;
  }
  // Server-side or env override
  return resolveApiBaseUrl();
}

const BASE_URL = getBaseUrl();

export interface StreamRequestOptions {
  method?: string;
  body?: unknown;
  headers?: Record<string, string>;
  signal?: AbortSignal;
}

/**
 * undici's `fetch` (used under Rstest/MSW) rejects jsdom `AbortSignal` instances
 * (`instanceof` fails across realms). Real browsers accept the page's signal.
 * Probe once; if incompatible, omit signal (callers still cancel via their own flags).
 */
let fetchSignalCompatible: boolean | null = null;

function resolveFetchSignal(signal?: AbortSignal): AbortSignal | undefined {
  if (signal === null || signal === undefined) return undefined;
  if (fetchSignalCompatible === false) return undefined;
  if (fetchSignalCompatible === true) return signal;
  try {
    // Trigger undici/jsdom realm check without performing a network request.
    void new Request('https://crystalith.invalid/', { method: 'GET', signal });
    fetchSignalCompatible = true;
    return signal;
  } catch {
    fetchSignalCompatible = false;
    return undefined;
  }
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
    signal: resolveFetchSignal(options.signal),
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
      // SSE events are delimited by a blank line (\n\n)
      const parts = buffer.split(/\n\n/u);
      buffer = parts.pop() ?? '';

      for (const part of parts) {
        const event = parseSseBlock(part);
        if (event) yield event;
      }
    }

    // Flush trailing block (some servers omit the final blank line)
    if (buffer.trim()) {
      const event = parseSseBlock(buffer);
      if (event) yield event;
    }
  } finally {
    reader.releaseLock();
  }
}
