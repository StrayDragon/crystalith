// API setup — formerly configured the hey-api generated client.
// Since c14 removed the generated client in favor of eden treaty,
// this module is kept as a compatibility stub.

// Re-export useful utilities for runtime error handling.
export type ApiClientError = Error & {
  status?: number;
  errorCode?: string;
  details?: unknown;
  retryAfter?: number;
};

export function parseRetryAfter(value: unknown): number | undefined {
  if (value === null) {
    return undefined;
  }

  if (typeof value === 'number' && Number.isFinite(value)) {
    return Math.max(0, Math.floor(value));
  }

  if (typeof value !== 'string') {
    return undefined;
  }

  const text = value.trim();
  if (!text) {
    return undefined;
  }

  const numeric = Number(text);
  if (Number.isFinite(numeric)) {
    return Math.max(0, Math.floor(numeric));
  }

  const timestamp = Date.parse(text);
  if (Number.isNaN(timestamp)) {
    return undefined;
  }

  const seconds = Math.floor((timestamp - Date.now()) / 1000);
  return Math.max(0, seconds);
}
