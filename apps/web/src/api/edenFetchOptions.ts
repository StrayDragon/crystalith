/**
 * Attach AbortSignal to Eden treaty calls when the runtime accepts it.
 * jsdom's AbortSignal is a different realm from Node/undici `fetch` (Rstest+MSW),
 * so `new Request(..., { signal })` throws there — omit the signal and rely on
 * cooperative cancellation instead.
 */
export function edenFetchOptions(
  signal?: AbortSignal,
): { fetch: { signal: AbortSignal } } | undefined {
  if (!signal) return undefined;
  try {
    const probe = new Request('http://local.invalid/', { signal });
    void probe;
    return { fetch: { signal } };
  } catch {
    return undefined;
  }
}
