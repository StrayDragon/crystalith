import { OutputTypeSchema, type Template } from '@crystalith/shared';

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
      ? raw.configJson
      : {};
  const outputTypeRaw = 'outputType' in configJson ? configJson.outputType : undefined;
  const parsedOutputType = OutputTypeSchema.safeParse(outputTypeRaw);
  return {
    id: raw.id,
    name: raw.name ?? '',
    description: raw.description ?? '',
    isBuiltin: raw.isBuiltin,
    createdAt: raw.createdAt ?? '',
    config: {
      sessionTitles: asStringArray(
        'sessionTitles' in configJson ? configJson.sessionTitles : undefined,
      ),
      outputType: parsedOutputType.success ? parsedOutputType.data : null,
      sourceTags: asStringArray('sourceTags' in configJson ? configJson.sourceTags : undefined),
    },
  };
}
