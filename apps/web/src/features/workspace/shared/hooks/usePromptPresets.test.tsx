import { act, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import type { ReactNode } from 'react';
import { SWRConfig } from 'swr';
import { beforeEach, expect, test, vi } from 'vitest';

import { server } from '../../../../test-utils/msw/server';
import { renderHook } from '../../../../test-utils/renderHook';
import { usePromptPresets } from './usePromptPresets';

// The v2 backend serializePreset returns: { id, trigger, description,
// system_prompt, enabled, created_at, updated_at } (no preset_id / source).
// The hook normalizes these into PromptPresetItem (preset_id, source), so tests
// mock the raw v2 shape and assert on the normalized fields.

beforeEach(() => {
  vi.clearAllMocks();
});

function wrapSWR({ children }: { children: ReactNode }) {
  return <SWRConfig value={{ provider: () => new Map() }}>{children}</SWRConfig>;
}

test('lists custom prompt presets', async () => {
  server.use(
    http.get('*/v2/prompt-presets', () =>
      HttpResponse.json([
        {
          id: 1,
          trigger: 'stats',
          description: 'Stats preset',
          system_prompt: 'builtin',
          enabled: true,
          created_at: '2026-03-01T00:00:00Z',
          updated_at: '2026-03-01T00:00:00Z',
        },
        {
          id: 2,
          trigger: 'demo',
          description: 'Demo preset',
          system_prompt: 'demo',
          enabled: false,
          created_at: '2026-03-02T00:00:00Z',
          updated_at: '2026-03-02T00:00:00Z',
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
    http.get('*/v2/prompt-presets', () =>
      HttpResponse.json([
        {
          id: 1,
          trigger: 'stats',
          description: 'Stats preset',
          system_prompt: 'builtin',
          enabled: true,
          created_at: '2026-03-01T00:00:00Z',
          updated_at: '2026-03-01T00:00:00Z',
        },
      ]),
    ),
    http.post('*/v2/prompt-presets', async ({ request }) => {
      const body = (await request.json()) as Record<string, unknown>;
      return HttpResponse.json({
        id: 2,
        trigger: body.trigger ?? 'demo',
        description: body.description ?? null,
        system_prompt: body.system_prompt ?? '',
        enabled: body.enabled ?? true,
        created_at: '2026-03-02T00:00:00Z',
        updated_at: '2026-03-02T00:00:00Z',
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
    http.get('*/v2/prompt-presets', () =>
      HttpResponse.json([
        {
          id: 1,
          trigger: 'stats',
          description: 'Stats preset',
          system_prompt: 'builtin',
          enabled: true,
          created_at: '2026-03-01T00:00:00Z',
          updated_at: '2026-03-01T00:00:00Z',
        },
        {
          id: 3,
          trigger: 'demo',
          description: 'Old',
          system_prompt: 'old',
          enabled: true,
          created_at: '2026-03-02T00:00:00Z',
          updated_at: '2026-03-02T00:00:00Z',
        },
      ]),
    ),
    http.patch('*/v2/prompt-presets/:id', async ({ params, request }) => {
      const body = (await request.json()) as Record<string, unknown>;
      return HttpResponse.json({
        id: Number(params.id),
        trigger: body.trigger ?? 'demo',
        description: body.description ?? null,
        system_prompt: body.system_prompt ?? 'old',
        enabled: body.enabled ?? true,
        created_at: '2026-03-02T00:00:00Z',
        updated_at: '2026-03-02T00:00:00Z',
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
    http.get('*/v2/prompt-presets', () =>
      HttpResponse.json([
        {
          id: 1,
          trigger: 'stats',
          description: 'Stats preset',
          system_prompt: 'builtin',
          enabled: true,
          created_at: '2026-03-01T00:00:00Z',
          updated_at: '2026-03-01T00:00:00Z',
        },
        {
          id: 4,
          trigger: 'demo',
          description: 'Demo',
          system_prompt: 'demo',
          enabled: true,
          created_at: '2026-03-02T00:00:00Z',
          updated_at: '2026-03-02T00:00:00Z',
        },
      ]),
    ),
    http.delete('*/v2/prompt-presets/:id', () => HttpResponse.json({})),
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
