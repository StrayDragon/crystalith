import type { SlideGenerationConfig } from '../types';

export function normalizeGenerationConfig(raw: any): SlideGenerationConfig | null {
  if (!raw || typeof raw !== 'object') return null;
  const config = raw as Record<string, any>;
  return {
    quantity: config.quantity ?? null,
    audience: config.audience ?? null,
    structure: config.structure ?? null,
    tone: config.tone ?? null,
    language: config.language ?? null,
    density: config.density ?? null,
    themePreset: config.themePreset ?? config.theme_preset ?? null,
    frontmatter: config.frontmatter ?? null,
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
  themeTemplate: Record<string, any> | null | undefined,
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
