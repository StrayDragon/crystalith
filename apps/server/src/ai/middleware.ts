import type { LanguageModelV4 } from '@ai-sdk/provider';
// AI middleware — retry with exponential backoff for transient provider errors.
//
// Wraps a LanguageModelV4 so `generateText`/`streamText`/`generateObject`
// automatically retry on rate-limit (429) and 5xx errors.
//
// c40: aligned with v1 retry.py — honors Retry-After header, includes the
// full retryable status code set {408,409,425,429,500,502,503,504}, caps
// delay at maxDelayMs, and enforces a total timeout budget.
import { wrapLanguageModel } from 'ai';

import { getAiSettings } from '../shared/config.ts';

export interface RetryOptions {
  maxRetries: number;
  baseDelayMs: number;
  /** Upper bound on per-attempt delay (v1: max_delay=10s). */
  maxDelayMs: number;
  /** Total timeout budget across all retries in ms (undefined = no budget). */
  totalTimeoutMs?: number;
  /** Status codes that should trigger a retry. */
  retryableStatuses: number[];
}

/**
 * v1 retryable set (retry.py:15). Includes 408 (Request Timeout),
 * 409 (Conflict), 425 (Too Early) in addition to 429 + 5xx.
 */
const V1_RETRYABLE_STATUSES = [408, 409, 425, 429, 500, 502, 503, 504];

const DEFAULTS: RetryOptions = {
  maxRetries: 3,
  baseDelayMs: 1000,
  maxDelayMs: 10_000,
  retryableStatuses: V1_RETRYABLE_STATUSES,
};

/** Build retry options from config (ai.max_retries) merged with caller overrides. */
function resolveRetryOptions(opts?: Partial<RetryOptions>): RetryOptions {
  const ai = getAiSettings();
  return {
    ...DEFAULTS,
    maxRetries: ai.max_retries,
    ...opts,
  };
}

/** Wrap a model with retry middleware. */
export function withRetry(model: LanguageModelV4, opts?: Partial<RetryOptions>): LanguageModelV4 {
  const config = resolveRetryOptions(opts);

  return wrapLanguageModel({
    model,
    middleware: {
      wrapGenerate: ({ doGenerate }) => retryLoop(() => doGenerate(), config),
      wrapStream: ({ doStream }) => retryLoop(() => doStream(), config),
    },
  });
}

async function retryLoop<T>(fn: () => PromiseLike<T> | Promise<T>, opts: RetryOptions): Promise<T> {
  const started = Date.now();
  let lastError: unknown;
  for (let attempt = 0; attempt <= opts.maxRetries; attempt++) {
    // Check total timeout budget before each attempt.
    if (opts.totalTimeoutMs !== undefined) {
      const elapsed = Date.now() - started;
      if (elapsed >= opts.totalTimeoutMs) {
        throw new Error(`Retry budget exceeded after ${elapsed}ms`);
      }
    }

    try {
      return await fn();
    } catch (error) {
      lastError = error;
      if (attempt === opts.maxRetries) break;
      if (!isRetryable(error, opts.retryableStatuses)) break;

      const delay = computeDelay(error, attempt, opts);
      await sleep(delay);
    }
  }
  throw new Error(
    lastError instanceof Error
      ? lastError.message
      : `Retry failed after ${opts.maxRetries + 1} attempts`,
  );
}

/**
 * Compute delay: honor Retry-After header if present, otherwise exponential
 * backoff capped at maxDelayMs (v1 retry.py:186-187).
 */
function computeDelay(error: unknown, attempt: number, opts: RetryOptions): number {
  const retryAfter = extractRetryAfter(error);
  if (retryAfter !== undefined) return retryAfter;

  const exponential = opts.baseDelayMs * Math.pow(2, attempt);
  return Math.min(exponential, opts.maxDelayMs);
}

/**
 * Parse Retry-After header value (v1 retry.py:84-112).
 * Accepts either a non-negative integer (seconds) or an HTTP-date.
 * Returns delay in ms, or undefined if not present/unparseable.
 */
function extractRetryAfter(error: unknown): number | undefined {
  if (!error || typeof error !== 'object') return undefined;
  const err = error as {
    responseHeaders?: Record<string, string>;
    headers?: Record<string, string>;
  };
  const headers = err.responseHeaders ?? err.headers;
  if (!headers) return undefined;

  const value = headers['retry-after'] ?? headers['Retry-After'];
  if (!value) return undefined;

  // Numeric: seconds → ms
  const numeric = Number(value);
  if (!isNaN(numeric)) return Math.max(0, numeric * 1000);

  // HTTP-date: parse and compute remaining seconds
  const date = new Date(value);
  if (!isNaN(date.getTime())) {
    return Math.max(0, date.getTime() - Date.now());
  }
  return undefined;
}

function isRetryable(err: unknown, retryableStatuses: number[]): boolean {
  if (err && typeof err === 'object') {
    const status =
      (err as { statusCode?: number; status?: number }).statusCode ??
      (err as { status?: number }).status;
    if (status !== undefined && retryableStatuses.includes(status)) return true;

    // AI SDK errors carry a `name` like `AI_APICallError`.
    const name = (err as { name?: string }).name ?? '';
    if (name.includes('RateLimit') || name.includes('Retry')) return true;
  }
  // Network errors (fetch failed) are retryable.
  if (err instanceof TypeError && err.message.includes('fetch')) return true;
  return false;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}
