import { client } from './generated/client.gen';

type ApiClientError = Error & {
  status?: number;
  errorCode?: string;
  details?: unknown;
  retryAfter?: number;
};

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object') {
    return null;
  }
  return value as Record<string, unknown>;
}

function readHeaderValue(headers: unknown, name: string): unknown {
  if (!headers) return undefined;

  if (typeof (headers as { get?: unknown }).get === 'function') {
    const getter = (headers as { get: (key: string) => unknown }).get;
    return getter(name) ?? getter(name.toLowerCase()) ?? getter(name.toUpperCase());
  }

  const record = asRecord(headers);
  if (!record) return undefined;

  const lowerName = name.toLowerCase();
  for (const [key, value] of Object.entries(record)) {
    if (key.toLowerCase() === lowerName) {
      return value;
    }
  }

  return undefined;
}

function parseRetryAfter(value: unknown): number | undefined {
  if (value == null) {
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

// hey-api calls `const _fetch = opts.fetch; _fetch(request)` — unbound `globalThis.fetch`
// throws "Illegal invocation" in browser contexts (e.g. Cursor webview).
const browserFetch: typeof fetch = (input, init) => globalThis.fetch(input, init);

client.setConfig({
  baseUrl: '',
  responseStyle: 'fields',
  throwOnError: true,
  fetch: browserFetch,
});

client.interceptors.error.use(async (error, response) => {
  const status = response && typeof response.status === 'number' ? response.status : undefined;

  const retryAfterFromHeader = parseRetryAfter(readHeaderValue(response?.headers, 'retry-after'));

  const attach = (
    err: Error,
    extras?: Partial<Pick<ApiClientError, 'errorCode' | 'details' | 'retryAfter'>>,
  ): ApiClientError => {
    const enriched = err as ApiClientError;
    if (status !== undefined) {
      enriched.status = status;
    }
    if (extras?.errorCode !== undefined) {
      enriched.errorCode = extras.errorCode;
    }
    if (extras?.details !== undefined) {
      enriched.details = extras.details;
    }
    if (extras?.retryAfter !== undefined) {
      enriched.retryAfter = extras.retryAfter;
    } else if (retryAfterFromHeader !== undefined) {
      enriched.retryAfter = retryAfterFromHeader;
    }
    return enriched;
  };

  const errorRecord = asRecord(error);

  if (errorRecord) {
    const hasStandardFields =
      typeof errorRecord.error_code === 'string' && typeof errorRecord.message === 'string';

    if (hasStandardFields) {
      return attach(new Error(String(errorRecord.message)), {
        errorCode: String(errorRecord.error_code),
        details: errorRecord.details,
        retryAfter: parseRetryAfter(errorRecord.retry_after) ?? retryAfterFromHeader,
      });
    }

    if (typeof errorRecord.detail === 'string') {
      return attach(new Error(String(errorRecord.detail)), {
        details: errorRecord.details,
      });
    }

    if (typeof errorRecord.message === 'string') {
      return attach(new Error(String(errorRecord.message)), {
        details: errorRecord.details,
      });
    }
  }

  if (error instanceof Error) {
    return attach(error);
  }

  if (typeof error === 'string') {
    return attach(new Error(error));
  }

  return attach(new Error('Unknown error'));
});
