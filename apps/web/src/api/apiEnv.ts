/** Resolve API base URL from import.meta.env (SSR / non-browser paths). */
export function resolveApiBaseUrl(fallback = 'http://localhost:8032'): string {
  return import.meta.env.VITE_API_BASE_URL ?? fallback;
}
