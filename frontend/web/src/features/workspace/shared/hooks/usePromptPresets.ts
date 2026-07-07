import { useMemo } from "react";

/**
 * NOTE: Prompt presets CRUD API was intentionally removed from the backend.
 *
 * Commit `7a935ff7` deleted `features/prompt_presets/api.py` and unregistered
 * the router from `web/routers.py`. The service/repo layer was kept.
 *
 * This hook now returns safe defaults (empty list, no-op functions) so
 * the frontend builds. The prompt presets feature is effectively disabled.
 *
 * To restore:
 *   1. Re-implement `api.py` (see git show 7a935ff7:features/prompt_presets/api.py)
 *   2. Register router in `web/routers.py`
 *   3. Regenerate OpenAPI (`just api-export`) and TS SDK (`pnpm run api:sync`)
 *   4. Restore this hook's real implementation
 */
export function usePromptPresets(_options?: { enabled?: boolean }) {
  const presets = useMemo<never[]>(() => [], []);

  const refreshPresets = async () => {};
  const refreshCommands = async () => {};
  const createCustomPreset = async (_payload: {
    trigger: string;
    description?: string | null;
    systemPrompt: string;
    enabled?: boolean;
  }) => {
    throw new Error("Prompt presets API is not available");
  };
  const updateCustomPreset = async (
    _presetId: number,
    _payload: {
      trigger?: string | null;
      description?: string | null;
      systemPrompt?: string | null;
      enabled?: boolean | null;
    },
  ) => {
    throw new Error("Prompt presets API is not available");
  };
  const deleteCustomPreset = async (_presetId: number) => {
    throw new Error("Prompt presets API is not available");
  };

  return {
    presets,
    isLoading: false,
    error: "",
    refreshPresets,
    refreshCommands,
    createCustomPreset,
    updateCustomPreset,
    deleteCustomPreset,
  };
}
