import { useMemo } from "react";

import type { OutputTypeId } from "../../shared/types";
import { normalizeTemplate } from "./types";

/**
 * NOTE: Templates CRUD API was intentionally removed from the backend.
 *
 * Commit `7a935ff7` deleted `features/templates/api.py` and unregistered
 * the router from `web/routers.py`. The service/repo layer was kept.
 *
 * This hook now returns safe defaults (empty list, no-op functions) so
 * the frontend builds. The templates feature is effectively disabled.
 *
 * To restore:
 *   1. Re-implement `api.py` (see git show 7a935ff7:features/templates/api.py)
 *   2. Register router in `web/routers.py`
 *   3. Regenerate OpenAPI (`just api-export`) and TS SDK (`pnpm run api:sync`)
 *   4. Restore this hook's real implementation
 */
export function useTemplates() {
  const templates = useMemo<ReturnType<typeof normalizeTemplate>[]>(() => [], []);

  const createCustomTemplate = async (_payload: {
    name: string;
    description?: string;
    sessionTitles?: string[];
    outputType?: OutputTypeId | null;
    sourceTags?: string[];
  }) => {
    throw new Error("Templates API is not available");
  };

  const updateTemplateDescription = async (_templateId: number, _description: string) => {
    throw new Error("Templates API is not available");
  };

  const removeTemplate = async (_templateId: number) => {
    throw new Error("Templates API is not available");
  };

  const saveCurrentNotebookAsTemplate = async (_payload: {
    notebookId: number;
    name: string;
    description?: string;
    outputType?: OutputTypeId | null;
  }) => {
    throw new Error("Templates API is not available");
  };

  return {
    templates,
    isLoading: false,
    error: "",
    createCustomTemplate,
    updateTemplateDescription,
    removeTemplate,
    saveCurrentNotebookAsTemplate,
  };
}
