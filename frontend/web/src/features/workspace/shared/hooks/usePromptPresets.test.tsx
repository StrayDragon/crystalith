import { act, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, expect, test, vi } from 'vitest';
import { SWRConfig } from 'swr';
import { http, HttpResponse } from 'msw';

import { renderHook } from '../../../../test-utils/renderHook';
import { server } from '../../../../test-utils/msw/server';
import { usePromptPresets } from './usePromptPresets';

beforeEach(() => {
  vi.clearAllMocks();
});

function wrapSWR({ children }: { children: ReactNode }) {
  return <SWRConfig value={{ provider: () => new Map() }}>{children}</SWRConfig>;
}

test('lists builtin and custom prompt presets', async () => {
  server.use(
    http.get('*/v1/prompt-presets', () =>
      HttpResponse.json([
        {
          preset_id: null,
          trigger: 'stats',
          description: 'Builtin stats',
          system_prompt: 'builtin',
          enabled: true,
          source: 'builtin',
          created_at: null,
          updated_at: null,
        },
        {
          preset_id: 1,
          trigger: 'demo',
          description: 'Demo preset',
          system_prompt: 'demo',
          enabled: false,
          source: 'custom',
          created_at: '2026-03-02',
          updated_at: '2026-03-02',
        },
      ]),
    ),
  );

  const { result } = renderHook(() => usePromptPresets(), { wrapper: wrapSWR });

  await waitFor(() => {
    expect(result.current.presets).toHaveLength(2);
  });

  expect(result.current.presets.map((item) => item.trigger)).toEqual(['stats', 'demo']);
});

test('createCustomPreset appends the created preset', async () => {
  server.use(
    http.get('*/v1/prompt-presets', () =>
      HttpResponse.json([
        {
          preset_id: null,
          trigger: 'stats',
          description: 'Builtin stats',
          system_prompt: 'builtin',
          enabled: true,
          source: 'builtin',
          created_at: null,
          updated_at: null,
        },
      ]),
    ),
    http.post('*/v1/prompt-presets', async ({ request }) => {
      const body = (await request.json()) as Record<string, unknown>;
      return HttpResponse.json({
        preset_id: 2,
        trigger: body.trigger ?? 'demo',
        description: body.description ?? null,
        system_prompt: body.system_prompt ?? '',
        enabled: body.enabled ?? true,
        source: 'custom',
        created_at: '2026-03-02',
        updated_at: '2026-03-02',
      });
    }),
  );

  const { result } = renderHook(() => usePromptPresets(), { wrapper: wrapSWR });

  await waitFor(() => {
    expect(result.current.isLoading).toBe(false);
  });

  await act(async () => {
    await result.current.createCustomPreset({
      trigger: 'demo',
      description: 'Demo',
      systemPrompt: 'Answer using bullet points.',
      enabled: true,
    });
  });

  await waitFor(() => {
    expect(result.current.presets).toHaveLength(2);
  });
});

test('updateCustomPreset patches and updates local list', async () => {
  server.use(
    http.get('*/v1/prompt-presets', () =>
      HttpResponse.json([
        {
          preset_id: null,
          trigger: 'stats',
          description: 'Builtin stats',
          system_prompt: 'builtin',
          enabled: true,
          source: 'builtin',
          created_at: null,
          updated_at: null,
        },
        {
          preset_id: 3,
          trigger: 'demo',
          description: 'Old',
          system_prompt: 'old',
          enabled: true,
          source: 'custom',
          created_at: '2026-03-02',
          updated_at: '2026-03-02',
        },
      ]),
    ),
    http.patch('*/v1/prompt-presets/:preset_id', async ({ params, request }) => {
      const body = (await request.json()) as Record<string, unknown>;
      return HttpResponse.json({
        preset_id: Number(params.preset_id),
        trigger: body.trigger ?? 'demo',
        description: body.description ?? null,
        system_prompt: body.system_prompt ?? '',
        enabled: body.enabled ?? true,
        source: 'custom',
        created_at: '2026-03-02',
        updated_at: '2026-03-02',
      });
    }),
  );

  const { result } = renderHook(() => usePromptPresets(), { wrapper: wrapSWR });

  await waitFor(() => {
    expect(result.current.presets).toHaveLength(2);
  });

  await act(async () => {
    await result.current.updateCustomPreset(3, {
      description: 'Updated',
      enabled: false,
    });
  });

  await waitFor(() => {
    const updated = result.current.presets.find((item) => item.preset_id === 3);
    expect(updated?.enabled).toBe(false);
    expect(updated?.description).toBe('Updated');
  });
});

test('deleteCustomPreset deletes and removes from local list', async () => {
  server.use(
    http.get('*/v1/prompt-presets', () =>
      HttpResponse.json([
        {
          preset_id: null,
          trigger: 'stats',
          description: 'Builtin stats',
          system_prompt: 'builtin',
          enabled: true,
          source: 'builtin',
          created_at: null,
          updated_at: null,
        },
        {
          preset_id: 4,
          trigger: 'demo',
          description: 'Demo',
          system_prompt: 'demo',
          enabled: true,
          source: 'custom',
          created_at: '2026-03-02',
          updated_at: '2026-03-02',
        },
      ]),
    ),
    http.delete('*/v1/prompt-presets/:preset_id', () => HttpResponse.json({})),
  );

  const { result } = renderHook(() => usePromptPresets(), { wrapper: wrapSWR });

  await waitFor(() => {
    expect(result.current.presets).toHaveLength(2);
  });

  await act(async () => {
    await result.current.deleteCustomPreset(4);
  });

  await waitFor(() => {
    expect(result.current.presets).toHaveLength(1);
  });
});
