import { useCallback, useMemo } from "react";
import useSWR, { useSWRConfig } from "swr";

import {
  createPromptPresetV1PromptPresetsPost as createPromptPreset,
  deletePromptPresetV1PromptPresetsPresetIdDelete as deletePromptPreset,
  listPromptPresetsV1PromptPresetsGet as listPromptPresets,
  updatePromptPresetV1PromptPresetsPresetIdPatch as updatePromptPreset,
  type PromptPresetRead,
} from "../../../../api/generated";
import { unwrapData } from "../../../../api/unwrap";
import { COMMANDS_CACHE_KEY } from "./useCommands";

export const PROMPT_PRESETS_CACHE_KEY = "workspace/prompt-presets";

function normalizePreset(preset: PromptPresetRead): PromptPresetRead {
  return {
    ...preset,
    description: preset.description ?? null,
    preset_id: preset.preset_id ?? null,
    created_at: preset.created_at ?? null,
    updated_at: preset.updated_at ?? null,
  };
}

export function usePromptPresets(options?: { enabled?: boolean }) {
  const enabled = options?.enabled ?? true;
  const { mutate: globalMutate } = useSWRConfig();

  const { data, error, isLoading, mutate } = useSWR(
    enabled ? PROMPT_PRESETS_CACHE_KEY : null,
    () => unwrapData(listPromptPresets<true>()),
    { revalidateOnFocus: false },
  );

  const presets = useMemo(() => (data ? data.map(normalizePreset) : []), [data]);

  const refreshCommands = useCallback(async () => {
    await globalMutate(COMMANDS_CACHE_KEY);
  }, [globalMutate]);

  const refreshPresets = useCallback(async () => {
    await mutate();
  }, [mutate]);

  const createCustomPreset = useCallback(
    async (payload: {
      trigger: string;
      description?: string | null;
      systemPrompt: string;
      enabled?: boolean;
    }) => {
      const created = await unwrapData(
        createPromptPreset<true>({
          body: {
            trigger: payload.trigger,
            description: payload.description ?? null,
            system_prompt: payload.systemPrompt,
            enabled: payload.enabled ?? true,
          },
        }),
      );

      await mutate(async (current) => (current ? [...current, created] : [created]), {
        revalidate: false,
      });
      await refreshCommands();
      return normalizePreset(created);
    },
    [mutate, refreshCommands],
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
      const updated = await unwrapData(
        updatePromptPreset<true>({
          path: { preset_id: presetId },
          body: {
            trigger: payload.trigger ?? undefined,
            description: payload.description ?? undefined,
            system_prompt: payload.systemPrompt ?? undefined,
            enabled: payload.enabled ?? undefined,
          },
        }),
      );

      await mutate(
        async (current) =>
          current?.map((item) => (item.preset_id === presetId ? updated : item)) ?? [updated],
        { revalidate: false },
      );
      await refreshCommands();
      return normalizePreset(updated);
    },
    [mutate, refreshCommands],
  );

  const deleteCustomPreset = useCallback(
    async (presetId: number) => {
      await unwrapData(deletePromptPreset<true>({ path: { preset_id: presetId } }));
      await mutate(
        async (current) => current?.filter((item) => item.preset_id !== presetId) ?? [],
        { revalidate: false },
      );
      await refreshCommands();
    },
    [mutate, refreshCommands],
  );

  return {
    presets,
    isLoading,
    error: error ? String(error) : "",
    refreshPresets,
    refreshCommands,
    createCustomPreset,
    updateCustomPreset,
    deleteCustomPreset,
  };
}
