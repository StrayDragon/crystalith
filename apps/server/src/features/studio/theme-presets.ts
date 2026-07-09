// Theme presets for Slidev generation (mirrors v1 config.py:60-195).
// Each preset defines deterministic frontmatter that replaces LLM-generated
// frontmatter (stripped before rendering).
export interface ThemePreset {
  name: string;
  label: string;
  theme: string;
  font?: string;
  background?: string;
  transition?: string;
}

export const THEME_PRESETS: Record<string, ThemePreset> = {
  'minimal-clean': {
    name: 'minimal-clean',
    label: '简约清晰',
    theme: 'seriph',
    font: 'Inter',
    transition: 'slide-left',
  },
  'business-brief': {
    name: 'business-brief',
    label: '商务简报',
    theme: 'apple-basic',
    font: 'DM Sans',
    transition: 'fade',
  },
  'product-launch': {
    name: 'product-launch',
    label: '产品发布',
    theme: 'default',
    background: 'linear-gradient(to bottom, #667eea, #764ba2)',
    transition: 'fade-out',
  },
  'research-paper': {
    name: 'research-paper',
    label: '学术论文',
    theme: 'penguin',
    font: 'IBM Plex Serif',
    transition: 'slide-left',
  },
  'data-insight': {
    name: 'data-insight',
    label: '数据洞察',
    theme: 'light-icons',
    transition: 'fade',
  },
  'creative-visual': {
    name: 'creative-visual',
    label: '创意视觉',
    theme: 'bricks',
    font: 'Space Grotesk',
    transition: 'fade',
  },
};

/**
 * Build deterministic Slidev frontmatter YAML from a preset.
 * LLM frontmatter is stripped and replaced with this.
 */
export function buildFrontmatter(preset: string): string {
  const p = THEME_PRESETS[preset] ?? THEME_PRESETS['minimal-clean'];
  const lines: string[] = [];
  lines.push(`theme: ${p.theme}`);
  if (p.font) lines.push(`fonts:\n  sans: ${p.font}`);
  if (p.background) lines.push(`background: ${p.background}`);
  if (p.transition) lines.push(`transition: ${p.transition}`);
  return `---\n${lines.join('\n')}\n---\n`;
}

/** List available preset names and labels for UI. */
export function listThemePresets(): { name: string; label: string }[] {
  return Object.entries(THEME_PRESETS).map(([name, p]) => ({ name, label: p.label }));
}
