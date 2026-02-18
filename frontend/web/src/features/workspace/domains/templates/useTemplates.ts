import { useCallback, useMemo } from 'react';
import useSWR from 'swr';

import {
  createTemplateV1TemplatesPost as createTemplate,
  deleteTemplateV1TemplatesTemplateIdDelete as deleteTemplate,
  listTemplatesV1TemplatesGet as listTemplates,
  saveNotebookAsTemplateV1NotebooksNotebookIdTemplatesPost as saveNotebookAsTemplate,
  updateTemplateV1TemplatesTemplateIdPatch as updateTemplate,
} from '../../../../api/generated';
import { unwrapData } from '../../../../api/unwrap';
import type { OutputTypeId } from '../../shared/types';
import { normalizeTemplate, type WorkspaceTemplate } from './types';

export function useTemplates() {
  const {
    data,
    error,
    isLoading,
    mutate,
  } = useSWR('workspace/templates', () => unwrapData(listTemplates<true>()), {
    revalidateOnFocus: false,
  });

  const templates = useMemo(() => (data ? data.map(normalizeTemplate) : []), [data]);

  const createCustomTemplate = useCallback(
    async (payload: {
      name: string;
      description?: string;
      sessionTitles?: string[];
      outputType?: OutputTypeId | null;
      sourceTags?: string[];
    }) => {
      const created = await unwrapData(createTemplate<true>({
        body: {
          name: payload.name,
          description: payload.description ?? null,
          config_json: {
            session_titles: payload.sessionTitles ?? [],
            output_type: payload.outputType ?? null,
            source_tags: payload.sourceTags ?? [],
          },
        },
      }));

      await mutate(
        async (current) => (current ? [...current, created] : [created]),
        { revalidate: false },
      );
      return normalizeTemplate(created);
    },
    [mutate],
  );

  const updateTemplateDescription = useCallback(
    async (templateId: number, description: string) => {
      const updated = await unwrapData(updateTemplate<true>({
        path: { template_id: templateId },
        body: { description },
      }));
      await mutate(
        async (current) =>
          current?.map((item) => (item.id === templateId ? updated : item)) ?? [updated],
        { revalidate: false },
      );
      return normalizeTemplate(updated);
    },
    [mutate],
  );

  const removeTemplate = useCallback(
    async (templateId: number) => {
      await unwrapData(deleteTemplate<true>({ path: { template_id: templateId } }));
      await mutate(
        async (current) => current?.filter((item) => item.id !== templateId) ?? [],
        { revalidate: false },
      );
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
      const created = await unwrapData(saveNotebookAsTemplate<true>({
        path: { notebook_id: payload.notebookId },
        body: {
          name: payload.name,
          description: payload.description ?? null,
          output_type: payload.outputType ?? null,
        },
      }));
      await mutate(
        async (current) => (current ? [...current, created] : [created]),
        { revalidate: false },
      );
      return normalizeTemplate(created);
    },
    [mutate],
  );

  return {
    templates,
    isLoading,
    error: error ? String(error) : '',
    createCustomTemplate,
    updateTemplateDescription,
    removeTemplate,
    saveCurrentNotebookAsTemplate,
  };
}
