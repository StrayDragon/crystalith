import { act, waitFor } from '@testing-library/react';
import { beforeEach, expect, test, vi } from 'vitest';
import { SWRConfig } from 'swr';
import type { ReactNode } from 'react';

import { renderHook } from '../../../../test-utils/renderHook';
import { useTemplates } from './useTemplates';
import {
  deleteTemplateV1TemplatesTemplateIdDelete,
  listTemplatesV1TemplatesGet,
  saveNotebookAsTemplateV1NotebooksNotebookIdTemplatesPost,
  updateTemplateV1TemplatesTemplateIdPatch,
} from '../../../../api/generated';

vi.mock('../../../../api/generated', () => ({
  listTemplatesV1TemplatesGet: vi.fn(),
  createTemplateV1TemplatesPost: vi.fn(),
  updateTemplateV1TemplatesTemplateIdPatch: vi.fn(),
  deleteTemplateV1TemplatesTemplateIdDelete: vi.fn(),
  saveNotebookAsTemplateV1NotebooksNotebookIdTemplatesPost: vi.fn(),
}));

beforeEach(() => {
  vi.clearAllMocks();
});

function wrapSWR({ children }: { children: ReactNode }) {
  return <SWRConfig value={{ provider: () => new Map() }}>{children}</SWRConfig>;
}

test('lists templates and normalizes config fields', async () => {
  vi.mocked(listTemplatesV1TemplatesGet).mockResolvedValue({
    data: [
      {
        id: 1,
        name: 'T1',
        description: 'desc',
        is_builtin: true,
        created_at: '2026-01-01',
        config_json: { session_titles: ['A'], output_type: 'FAQ', source_tags: ['x'] },
      },
    ],
  } as any);

  const { result } = renderHook(() => useTemplates(), { wrapper: wrapSWR });

  await waitFor(() => {
    expect(result.current.templates).toHaveLength(1);
  });

  expect(result.current.templates[0].isBuiltin).toBe(true);
  expect(result.current.templates[0].config.outputType).toBe('FAQ');
  expect(result.current.templates[0].config.sessionTitles).toEqual(['A']);
  expect(result.current.templates[0].config.sourceTags).toEqual(['x']);
});

test('saveCurrentNotebookAsTemplate appends new template', async () => {
  vi.mocked(listTemplatesV1TemplatesGet).mockResolvedValue({ data: [] } as any);
  vi.mocked(saveNotebookAsTemplateV1NotebooksNotebookIdTemplatesPost).mockResolvedValue({
    data: {
      id: 2,
      name: 'Saved',
      description: null,
      is_builtin: false,
      created_at: '2026-01-02',
      config_json: { session_titles: [], output_type: 'GUIDE', source_tags: [] },
    },
  } as any);

  const { result } = renderHook(() => useTemplates(), { wrapper: wrapSWR });

  await waitFor(() => {
    expect(result.current.isLoading).toBe(false);
  });

  await act(async () => {
    await result.current.saveCurrentNotebookAsTemplate({
      notebookId: 1,
      name: 'Saved',
      outputType: 'GUIDE',
    });
  });

  await waitFor(() => {
    expect(result.current.templates).toHaveLength(1);
  });
  expect(result.current.templates[0].name).toBe('Saved');
});

test('updateTemplateDescription patches and updates list', async () => {
  vi.mocked(listTemplatesV1TemplatesGet).mockResolvedValue({
    data: [
      {
        id: 3,
        name: 'Editable',
        description: 'old',
        is_builtin: false,
        created_at: '2026-01-03',
        config_json: { session_titles: [], output_type: null, source_tags: [] },
      },
    ],
  } as any);

  vi.mocked(updateTemplateV1TemplatesTemplateIdPatch).mockResolvedValue({
    data: {
      id: 3,
      name: 'Editable',
      description: 'new',
      is_builtin: false,
      created_at: '2026-01-03',
      config_json: { session_titles: [], output_type: null, source_tags: [] },
    },
  } as any);

  const { result } = renderHook(() => useTemplates(), { wrapper: wrapSWR });

  await waitFor(() => {
    expect(result.current.templates).toHaveLength(1);
  });

  await act(async () => {
    await result.current.updateTemplateDescription(3, 'new');
  });

  await waitFor(() => {
    expect(result.current.templates[0].description).toBe('new');
  });
});

test('removeTemplate deletes and removes from list', async () => {
  vi.mocked(listTemplatesV1TemplatesGet).mockResolvedValue({
    data: [
      {
        id: 4,
        name: 'ToDelete',
        description: '',
        is_builtin: false,
        created_at: '2026-01-04',
        config_json: { session_titles: [], output_type: null, source_tags: [] },
      },
    ],
  } as any);

  vi.mocked(deleteTemplateV1TemplatesTemplateIdDelete).mockResolvedValue({ data: {} } as any);

  const { result } = renderHook(() => useTemplates(), { wrapper: wrapSWR });

  await waitFor(() => {
    expect(result.current.templates).toHaveLength(1);
  });

  await act(async () => {
    await result.current.removeTemplate(4);
  });

  await waitFor(() => {
    expect(result.current.templates).toHaveLength(0);
  });
});
