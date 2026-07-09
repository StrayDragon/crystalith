// crystalith-slidev — Slidev integration package.
// Currently exports types and a placeholder render function. The full
// Slidev integration (preview, export) is deferred to post-Phase-4.
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
