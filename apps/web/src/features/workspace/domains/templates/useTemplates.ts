import { useCallback } from 'react';
import useSWR from 'swr';

import { api } from '../../../../api/eden';
import type { OutputTypeId } from '../../shared/types';
import { normalizeTemplate, type WorkspaceTemplate } from './types';

// Templates hook — CRUD over /v2/templates via eden treaty.
//
// The v2 backend (c12) restored full templates CRUD. This hook calls those
// endpoints; config_json is assembled from discrete fields on write and
// unpacked into WorkspaceTemplate.config on read (see normalizeTemplate).
const SWR_KEY = 'workspace/templates';

export function useTemplates() {
  const {
    data: templates = [],
    error: swrError,
    isLoading,
    mutate,
  } = useSWR<WorkspaceTemplate[]>(
    SWR_KEY,
    async () => {
      const { data, error } = await api.v2.templates.get();
      if (error) throw new Error(String(error));
      return (data ?? []).map(normalizeTemplate);
    },
    { revalidateOnFocus: false },
  );

  const refresh = useCallback(async () => {
    await mutate();
  }, [mutate]);

  const createCustomTemplate = useCallback(
    async (payload: {
      name: string;
      description?: string;
      sessionTitles?: string[];
      outputType?: OutputTypeId | null;
      sourceTags?: string[];
    }) => {
      const { data, error } = await api.v2.templates.post({
        name: payload.name,
        description: payload.description ?? null,
        config_json: {
          session_titles: payload.sessionTitles ?? [],
          output_type: payload.outputType ?? null,
          source_tags: payload.sourceTags ?? [],
        },
      });
      if (error) throw new Error(String(error));
      const created = normalizeTemplate(data!);
      await mutate(async (current) => [...(current ?? []), created], {
        revalidate: false,
      });
      return created;
    },
    [mutate],
  );

  const saveCurrentNotebookAsTemplate = useCallback(
    async (payload: {
      notebookId: number;
      name: string;
      description?: string;
      outputType?: OutputTypeId | null;
    }) => {
      // The v2 backend stores templates with a flat config_json; notebookId is
      // not persisted server-side (templates are notebook-agnostic), so we only
      // forward name/description + config.
      const { data, error } = await api.v2.templates.post({
        name: payload.name,
        description: payload.description ?? null,
        config_json: {
          session_titles: [],
          output_type: payload.outputType ?? null,
          source_tags: [],
        },
      });
      if (error) throw new Error(String(error));
      const created = normalizeTemplate(data!);
      await mutate(async (current) => [...(current ?? []), created], {
        revalidate: false,
      });
      return created;
    },
    [mutate],
  );

  const updateTemplateDescription = useCallback(
    async (templateId: number, description: string) => {
      const { data, error } = await api.v2.templates({ id: templateId }).patch({
        description,
      });
      if (error) throw new Error(String(error));
      const updated = normalizeTemplate(data!);
      await mutate(
        async (current) => current?.map((t) => (t.id === templateId ? updated : t)) ?? [updated],
        { revalidate: false },
      );
      return updated;
    },
    [mutate],
  );

  const removeTemplate = useCallback(
    async (templateId: number) => {
      const { error } = await api.v2.templates({ id: templateId }).delete();
      if (error) throw new Error(String(error));
      await mutate(async (current) => current?.filter((t) => t.id !== templateId) ?? [], {
        revalidate: false,
      });
    },
    [mutate],
  );

  return {
    templates,
    isLoading,
    error: swrError ? String(swrError) : '',
    refresh,
    createCustomTemplate,
    updateTemplateDescription,
    removeTemplate,
    saveCurrentNotebookAsTemplate,
  };
}
