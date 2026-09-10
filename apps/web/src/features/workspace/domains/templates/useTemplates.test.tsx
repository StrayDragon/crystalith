import { beforeEach, expect, test, rs } from '@rstest/core';
import { act, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import type { ReactNode } from 'react';
import { SWRConfig } from 'swr';

import { server } from '../../../../test-utils/msw/server';
import { renderHook } from '../../../../test-utils/renderHook';
import { useTemplates } from './useTemplates';

beforeEach(() => {
  rs.clearAllMocks();
});

function wrapSWR({ children }: { children: ReactNode }) {
  return <SWRConfig value={{ provider: () => new Map() }}>{children}</SWRConfig>;
}

test('lists templates and normalizes config fields', async () => {
  server.use(
    http.get('*/v2/templates', () =>
      HttpResponse.json([
        {
          id: 1,
          name: 'T1',
          description: 'desc',
          isBuiltin: false,
          createdAt: '2026-01-01',
          configJson: { sessionTitles: ['A'], outputType: 'FAQ', sourceTags: ['x'] },
        },
      ]),
    ),
  );

  const { result } = renderHook(() => useTemplates(), { wrapper: wrapSWR });

  await waitFor(() => {
    expect(result.current.templates).toHaveLength(1);
  });

  expect(result.current.templates[0].isBuiltin).toBe(false);
  expect(result.current.templates[0].config.outputType).toBe('FAQ');
  expect(result.current.templates[0].config.sessionTitles).toEqual(['A']);
  expect(result.current.templates[0].config.sourceTags).toEqual(['x']);
});

test('saveCurrentNotebookAsTemplate appends new template', async () => {
  server.use(
    http.get('*/v2/templates', () => HttpResponse.json([])),
    http.post('*/v2/templates', async ({ request }) => {
      const body = (await request.json()) as Record<string, unknown>;
      return HttpResponse.json({
        id: 2,
        name: body.name ?? 'Saved',
        description: body.description ?? null,
        isBuiltin: false,
        createdAt: '2026-01-02',
        configJson: { sessionTitles: [], outputType: 'GUIDE', sourceTags: [] },
      });
    }),
  );

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
  server.use(
    http.get('*/v2/templates', () =>
      HttpResponse.json([
        {
          id: 3,
          name: 'Editable',
          description: 'old',
          isBuiltin: false,
          createdAt: '2026-01-03',
          configJson: { sessionTitles: [], outputType: null, sourceTags: [] },
        },
      ]),
    ),
    http.patch('*/v2/templates/:id', async ({ params, request }) => {
      const body = (await request.json()) as Record<string, unknown>;
      return HttpResponse.json({
        id: Number(params.id),
        name: 'Editable',
        description: body.description ?? 'new',
        isBuiltin: false,
        createdAt: '2026-01-03',
        configJson: { sessionTitles: [], outputType: null, sourceTags: [] },
      });
    }),
  );

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
  server.use(
    http.get('*/v2/templates', () =>
      HttpResponse.json([
        {
          id: 4,
          name: 'ToDelete',
          description: '',
          isBuiltin: false,
          createdAt: '2026-01-04',
          configJson: { sessionTitles: [], outputType: null, sourceTags: [] },
        },
      ]),
    ),
    http.delete('*/v2/templates/:id', () => HttpResponse.json({})),
  );

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
