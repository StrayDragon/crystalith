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

export function normalizeTemplate(raw: any): WorkspaceTemplate {
  const configJson = raw?.configJson ?? {};
  return {
    id: raw.id,
    name: raw.name ?? '',
    description: raw.description ?? '',
    isBuiltin: Boolean(raw.isBuiltin),
    createdAt: raw.createdAt ?? '',
    config: {
      sessionTitles: Array.isArray(configJson.sessionTitles)
        ? configJson.sessionTitles
        : Array.isArray(configJson.session_titles)
          ? configJson.session_titles
          : [],
      outputType: (configJson.outputType ?? null) as OutputTypeId | null,
      sourceTags: Array.isArray(configJson.sourceTags)
        ? configJson.sourceTags
        : Array.isArray(configJson.source_tags)
          ? configJson.source_tags
          : [],
    },
  };
}
