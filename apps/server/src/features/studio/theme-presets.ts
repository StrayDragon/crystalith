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

/**
 * YAML-encode a single frontmatter value (v1 _yaml_value, generator.py:118-125).
 * Objects/arrays → JSON; strings → as-is; null → "null".
 */
function yamlValue(v: unknown): string {
  if (v === null || v === undefined) return 'null';
  if (typeof v === 'object') return JSON.stringify(v);
  return typeof v === 'string' ? v : typeof v === 'string' ? v : '';
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
    .replace(/^---\n?/u, '')
    .replace(/\n?---\n?$/u, '')
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
    if (title && !/^title:/mu.test(override)) {
      body = `title: ${yamlValue(title)}\n${override}`;
    }
    return `---\n${body}\n---\n`;
  }
  const resolvedPreset = resolveThemePreset(preset);
  const template =
    THEME_PRESET_TEMPLATES[resolvedPreset] ?? THEME_PRESET_TEMPLATES['minimal-clean'];
  return `---\n${buildPresetBody(template, title)}\n---\n`;
}
