// crystalith-slidev — Slidev integration package.
// Preview URL helpers for the studio dialog; full Slidev render is deferred.

export interface SlidevConfig {
  theme: string;
  font?: string;
  background?: string;
  transition?: string;
  markdown: string;
}

/**
 * Placeholder: render Slidev markdown to slides.
 * Full implementation deferred — returns empty string for now.
 */
export function renderSlides(_config: SlidevConfig): { html: string } {
  // Post-Phase-4: wire @slidev/cli headless rendering.
  return { html: '' };
}

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
