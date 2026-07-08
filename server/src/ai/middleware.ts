// AI middleware — retry with exponential backoff for transient provider errors.
//
// Wraps a LanguageModelV4 so `generateText`/`streamText`/`generateObject`
// automatically retry on rate-limit (429) and 5xx errors.
import { wrapLanguageModel } from "ai";
import type { LanguageModelV4 } from "@ai-sdk/provider";

export interface RetryOptions {
  maxRetries: number;
  baseDelayMs: number;
  /** Status codes that should trigger a retry. */
  retryableStatuses: number[];
}

const DEFAULTS: RetryOptions = {
  maxRetries: 3,
  baseDelayMs: 1000,
  retryableStatuses: [429, 500, 502, 503, 504],
};

/** Wrap a model with retry middleware. */
export function withRetry(model: LanguageModelV4, opts: Partial<RetryOptions> = {}): LanguageModelV4 {
  const config = { ...DEFAULTS, ...opts };

  return wrapLanguageModel({
    model,
    middleware: {
      wrapGenerate: ({ doGenerate }) => retryLoop(() => doGenerate(), config),
      wrapStream: ({ doStream }) => retryLoop(() => doStream(), config),
    },
  });
}

async function retryLoop<T>(fn: () => PromiseLike<T> | Promise<T>, opts: RetryOptions): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt <= opts.maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      if (attempt === opts.maxRetries) break;
      if (!isRetryable(err, opts.retryableStatuses)) break;

      const delay = opts.baseDelayMs * Math.pow(2, attempt);
      await sleep(delay);
    }
  }
  throw lastError;
}

function isRetryable(err: unknown, retryableStatuses: number[]): boolean {
  if (err && typeof err === "object") {
    const status =
      (err as { statusCode?: number; status?: number }).statusCode ??
      (err as { status?: number }).status;
    if (status !== undefined && retryableStatuses.includes(status)) return true;

    // AI SDK errors carry a `name` like `AI_APICallError`.
    const name = (err as { name?: string }).name ?? "";
    if (name.includes("RateLimit") || name.includes("Retry")) return true;
  }
  // Network errors (fetch failed) are retryable.
  if (err instanceof TypeError && err.message.includes("fetch")) return true;
  return false;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
