const DEFAULT_PREVIEW_URL =
  import.meta.env.VITE_SLIDEV_PREVIEW_URL ||
  (import.meta.env.PROD ? '/slidev' : 'http://localhost:3030');

export function getSlidevPreviewBaseUrl(): string {
  return DEFAULT_PREVIEW_URL.replace(/\/+$/, '');
}

export function buildSlidevPreviewUrl(cacheKey?: string | number): string {
  const base = getSlidevPreviewBaseUrl();
  if (cacheKey === undefined || cacheKey === null) {
    return `${base}/`;
  }
  return `${base}/?t=${encodeURIComponent(String(cacheKey))}`;
}
