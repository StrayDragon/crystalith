import type { Template } from '@crystalith/shared';

import type { OutputTypeId } from '../../shared/types';

export interface TemplateConfig {
  sessionTitles: string[];
  outputType: OutputTypeId | null;
  sourceTags: string[];
}

export interface WorkspaceTemplate {
  id: number;
  name: string;
  description: string;
  isBuiltin: boolean;
  createdAt: string;
  config: TemplateConfig;
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string')
    : [];
}

export function normalizeTemplate(raw: Template): WorkspaceTemplate {
  const configJson =
    raw.configJson && typeof raw.configJson === 'object' && !Array.isArray(raw.configJson)
      ? (raw.configJson as Record<string, unknown>)
      : {};
  const outputType = configJson.outputType;
  return {
    id: raw.id,
    name: raw.name ?? '',
    description: raw.description ?? '',
    isBuiltin: Boolean(raw.isBuiltin),
    createdAt: raw.createdAt ?? '',
    config: {
      sessionTitles: asStringArray(configJson.sessionTitles),
      outputType: typeof outputType === 'string' ? (outputType as OutputTypeId) : null,
      sourceTags: asStringArray(configJson.sourceTags),
    },
  };
}
