import type { SlideGenerationConfig } from '../../../shared/types';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function asNullableString(value: unknown): string | null {
  return typeof value === 'string' ? value : null;
}

export function normalizeGenerationConfig(raw: unknown): SlideGenerationConfig | null {
  if (!isRecord(raw)) return null;
  const preference = raw.preference;
  return {
    preference: preference === 'quality' || preference === 'speed' ? preference : null,
    quantity: asNullableString(raw.quantity),
    audience: asNullableString(raw.audience),
    structure: asNullableString(raw.structure),
    tone: asNullableString(raw.tone),
    language: asNullableString(raw.language),
    density: asNullableString(raw.density),
    themePreset: asNullableString(raw.themePreset),
    frontmatter: asNullableString(raw.frontmatter),
  };
}

export function normalizeFrontmatterOverride(value: string | null | undefined): string {
  const trimmed = value?.trim() ?? '';
  if (!trimmed) return '';
  if (!trimmed.startsWith('---')) return trimmed;
  const lines = trimmed.split('\n');
  const stripped = lines[0].trim() === '---' ? lines.slice(1) : lines;
  const endIndex = stripped.findIndex((line, index) => index > 0 && line.trim() === '---');
  const body = endIndex >= 0 ? stripped.slice(0, endIndex) : stripped;
  return body.join('\n').trim();
}

function yamlValue(value: unknown) {
  if (value === null || value === undefined) return 'null';
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (typeof value === 'string') return JSON.stringify(value);
  return JSON.stringify(value);
}

export function buildFrontmatterPreview(
  title: string,
  themeTemplate: Record<string, unknown> | null | undefined,
  override: string,
): string {
  const normalizedOverride = normalizeFrontmatterOverride(override);
  if (normalizedOverride) {
    if (normalizedOverride.includes('title:')) {
      return normalizedOverride;
    }
    return `title: ${yamlValue(title)}\n${normalizedOverride}`.trim();
  }
  if (!themeTemplate) {
    return `title: ${yamlValue(title)}`;
  }
  const lines: string[] = [`title: ${yamlValue(title)}`];
  Object.entries(themeTemplate).forEach(([key, value]) => {
    if (key === 'fonts' && isRecord(value)) {
      lines.push('fonts:');
      Object.entries(value).forEach(([fontKey, fontValue]) => {
        lines.push(`  ${fontKey}: ${yamlValue(fontValue)}`);
      });
      return;
    }
    lines.push(`${key}: ${yamlValue(value)}`);
  });
  return lines.join('\n');
}
