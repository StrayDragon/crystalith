/** Resolve API base URL from Vite env (SSR / non-browser paths). */
export function viteApiBaseUrl(fallback = 'http://localhost:8032'): string {
  return import.meta.env.VITE_API_BASE_URL ?? fallback;
}
