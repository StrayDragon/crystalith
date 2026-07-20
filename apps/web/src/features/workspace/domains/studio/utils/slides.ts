import type { SlideGenerationConfig } from '../../../shared/types';

function asNullableString(value: unknown): string | null {
  return typeof value === 'string' ? value : null;
}

export function normalizeGenerationConfig(raw: unknown): SlideGenerationConfig | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const config = raw as Record<string, unknown>;
  const preference = config.preference;
  return {
    preference: preference === 'quality' || preference === 'speed' ? preference : null,
    quantity: asNullableString(config.quantity),
    audience: asNullableString(config.audience),
    structure: asNullableString(config.structure),
    tone: asNullableString(config.tone),
    language: asNullableString(config.language),
    density: asNullableString(config.density),
    themePreset: asNullableString(config.themePreset),
    frontmatter: asNullableString(config.frontmatter),
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
    if (key === 'fonts' && typeof value === 'object' && value) {
      lines.push('fonts:');
      Object.entries(value as Record<string, string>).forEach(([fontKey, fontValue]) => {
        lines.push(`  ${fontKey}: ${yamlValue(fontValue)}`);
      });
      return;
    }
    lines.push(`${key}: ${yamlValue(value)}`);
  });
  return lines.join('\n');
}
