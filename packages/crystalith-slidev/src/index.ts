// crystalith-slidev — Slidev integration package.
// Preview URL helpers for the studio slides dialog (iframe preview via
// same-origin `/slidev` path served by Vite dev / reverse-proxy in prod).

const DEFAULT_PREVIEW_URL =
  (import.meta !== undefined &&
    (import.meta as { env?: Record<string, string> }).env?.VITE_SLIDEV_PREVIEW_URL) ||
  // Same-origin path: Vite (dev) / reverse-proxy (prod) forward to Slidev.
  // Avoid cross-origin http://127.0.0.1:3030 iframes — browsers often refuse them.
  '/slidev';

export function getSlidevPreviewBaseUrl(): string {
  return String(DEFAULT_PREVIEW_URL).replace(/\/+$/u, '');
}

/** Build a Slidev preview iframe URL, optionally cache-busted with `cacheKey`. */
export function buildSlidevPreviewUrl(cacheKey?: string | number): string {
  const base = getSlidevPreviewBaseUrl();
  if (cacheKey === undefined || cacheKey === null) {
    return `${base}/`;
  }
  return `${base}/?t=${encodeURIComponent(String(cacheKey))}`;
}
