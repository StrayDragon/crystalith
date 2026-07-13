// Theme presets for Slidev generation — v1-aligned 6-key frontmatter templates.
//
// c56: rewritten to use THEME_PRESET_TEMPLATES from config.ts (v1 config.py:74-123
// verbatim). v1 always emits theme:default + colorSchema + fonts{sans,serif,mono}
// + transition + background + class. The prior v2 table used varied slidev themes
// (seriph/bricks) and dropped most fields — a visible rendering divergence.
//
// buildFrontmatter now supports the v1 override path (config.frontmatter bypasses
// the preset entirely) and title injection.
import { THEME_PRESET_TEMPLATES, resolveThemePreset, type ThemePresetTemplate } from './config.ts';

export interface ThemePreset {
  id: string;
  label: string;
  template: ThemePresetTemplate;
}

/** v1-aligned preset catalog (labels from config.py:164-195). */
export const THEME_PRESETS: Record<string, ThemePreset> = Object.fromEntries(
  Object.entries(THEME_PRESET_TEMPLATES).map(([id, template], _idx) => {
    const labels: Record<string, string> = {
      'minimal-clean': '清爽极简',
      'business-brief': '商务汇报',
      'product-launch': '产品发布',
      'research-paper': '学术研究',
      'data-insight': '数据洞察',
      'creative-visual': '创意视觉',
    };
    return [id, { id, label: labels[id] ?? id, template }];
  }),
);

/**
 * YAML-encode a single frontmatter value (v1 _yaml_value, generator.py:118-125).
 * Objects/arrays → JSON; strings → as-is; null → "null".
 */
function yamlValue(v: unknown): string {
  if (v === null || v === undefined) return 'null';
  if (typeof v === 'object') return JSON.stringify(v);
  return String(v);
}

/**
 * Build the frontmatter body lines from a preset template (v1 _build_frontmatter_body,
 * generator.py:128-147). Emits fonts: as a nested block and all other keys flat.
 */
function buildPresetBody(template: ThemePresetTemplate, title?: string | null): string {
  const lines: string[] = [];
  if (title) lines.push(`title: ${yamlValue(title)}`);
  lines.push(`theme: ${template.theme}`);
  lines.push(`colorSchema: ${template.colorSchema}`);
  lines.push('fonts:');
  lines.push(`  sans: ${template.fonts.sans}`);
  lines.push(`  serif: ${template.fonts.serif}`);
  lines.push(`  mono: ${template.fonts.mono}`);
  lines.push(`transition: ${template.transition}`);
  lines.push(`background: ${template.background}`);
  lines.push(`class: ${template.class}`);
  return lines.join('\n');
}

/**
 * Normalize a user-supplied frontmatter override (v1 _normalize_frontmatter_override,
 * generator.py:102-115). Strips surrounding --- fences and trims. Returns null if
 * the override is empty after cleaning.
 */
function normalizeOverride(raw: string): string | null {
  const cleaned = raw
    .replace(/^---\n?/, '')
    .replace(/\n?---\n?$/, '')
    .trim();
  return cleaned || null;
}

/**
 * Build deterministic Slidev frontmatter from a preset or override (v1 parity).
 *
 * - If frontmatterOverride is a non-empty string, it is cleaned of fences and
 *   used verbatim (a title: line is prepended if title is provided and the
 *   override lacks one). This bypasses the preset entirely.
 * - Otherwise the preset template is expanded into the v1 6-key body.
 *
 * The result is wrapped as `---\n{body}\n---\n`.
 */
export function buildFrontmatter(
  preset: string,
  title?: string | null,
  frontmatterOverride?: string | null,
): string {
  const override = frontmatterOverride ? normalizeOverride(frontmatterOverride) : null;
  if (override) {
    let body = override;
    if (title && !/^title:/m.test(override)) {
      body = `title: ${yamlValue(title)}\n${override}`;
    }
    return `---\n${body}\n---\n`;
  }
  const resolvedPreset = resolveThemePreset(preset);
  const template = THEME_PRESET_TEMPLATES[resolvedPreset]!;
  return `---\n${buildPresetBody(template, title)}\n---\n`;
}

/** List available preset names and labels for UI. */
export function listThemePresets(): { name: string; label: string }[] {
  return Object.entries(THEME_PRESETS).map(([name, p]) => ({ name, label: p.label }));
}
