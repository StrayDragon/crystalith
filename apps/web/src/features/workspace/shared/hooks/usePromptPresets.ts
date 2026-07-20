import type { PromptPreset } from '@crystalith/shared';
import { useCallback } from 'react';
import useSWR from 'swr';

import { api } from '../../../../api/eden';

// Prompt presets hook — CRUD over /v2/prompt-presets via eden treaty.
//
// The v2 backend (c12) restored full prompt-presets CRUD. The v2 schema has no
// `is_builtin` / `source` columns (all presets are user-created equals), so we
// derive `source: 'custom'` on the client to preserve the downstream consumer
// (SystemConfigDialog) contract. `preset_id` mirrors `id` for the same reason.
// Builtin presets are not surfaced in v2; `builtinPresets` stays empty.
const SWR_KEY = 'workspace/prompt-presets';

export interface PromptPresetItem {
  presetId: number | null;
  trigger: string;
  description: string | null;
  systemPrompt: string;
  enabled: boolean;
  source: 'builtin' | 'custom';
  createdAt: string | null;
  updatedAt: string | null;
}

function normalizePreset(raw: PromptPreset): PromptPresetItem {
  return {
    presetId: raw.id,
    trigger: raw.trigger,
    description: raw.description ?? null,
    systemPrompt: raw.systemPrompt,
    enabled: raw.enabled,
    source: 'custom',
    createdAt: raw.createdAt ?? null,
    updatedAt: raw.updatedAt ?? null,
  };
}

export function usePromptPresets(_options?: { enabled?: boolean }) {
  const {
    data: presets = [],
    error: swrError,
    isLoading,
    mutate,
  } = useSWR<PromptPresetItem[]>(
    SWR_KEY,
    async () => {
      const { data, error } = await api.v2['prompt-presets'].get();
      if (error)
        throw new Error(typeof error === 'string' ? error : typeof error === 'string' ? error : '');
      return (data ?? []).map(normalizePreset);
    },
    { revalidateOnFocus: false },
  );

  const refreshPresets = useCallback(async () => {
    await mutate();
  }, [mutate]);

  // Commands refresh is driven by the same data; kept for caller compatibility.
  const refreshCommands = refreshPresets;

  const createCustomPreset = useCallback(
    async (payload: {
      trigger: string;
      description?: string | null;
      systemPrompt: string;
      enabled?: boolean;
    }) => {
      const { data, error } = await api.v2['prompt-presets'].post({
        trigger: payload.trigger,
        description: payload.description ?? null,
        systemPrompt: payload.systemPrompt,
        enabled: payload.enabled ?? true,
      });
      if (error)
        throw new Error(typeof error === 'string' ? error : typeof error === 'string' ? error : '');
      if (!data || !('id' in data)) throw new Error('prompt-preset create failed');
      const created = normalizePreset(data);
      await mutate(async (current) => [...(current ?? []), created], {
        revalidate: false,
      });
      return created;
    },
    [mutate],
  );

  const updateCustomPreset = useCallback(
    async (
      presetId: number,
      payload: {
        trigger?: string | null;
        description?: string | null;
        systemPrompt?: string | null;
        enabled?: boolean | null;
      },
    ) => {
      const body: Record<string, unknown> = {};
      if (payload.trigger !== undefined) body.trigger = payload.trigger;
      if (payload.description !== undefined) body.description = payload.description;
      if (payload.systemPrompt !== undefined) body.systemPrompt = payload.systemPrompt;
      if (payload.enabled !== undefined) body.enabled = payload.enabled;

      const { data, error } = await api.v2['prompt-presets']({ id: presetId }).patch(body);
      if (error)
        throw new Error(typeof error === 'string' ? error : typeof error === 'string' ? error : '');
      if (!data || !('id' in data)) throw new Error('prompt-preset update failed');
      const updated = normalizePreset(data);
      await mutate(
        async (current) => current?.map((p) => (p.presetId === presetId ? updated : p)) ?? [],
        { revalidate: false },
      );
      return updated;
    },
    [mutate],
  );

  const deleteCustomPreset = useCallback(
    async (presetId: number) => {
      const { error } = await api.v2['prompt-presets']({ id: presetId }).delete();
      if (error)
        throw new Error(typeof error === 'string' ? error : typeof error === 'string' ? error : '');
      await mutate(async (current) => current?.filter((p) => p.presetId !== presetId) ?? [], {
        revalidate: false,
      });
    },
    [mutate],
  );

  return {
    presets,
    isLoading,
    error: swrError ? String(swrError) : '',
    refreshPresets,
    refreshCommands,
    createCustomPreset,
    updateCustomPreset,
    deleteCustomPreset,
  };
}
