import { act, waitFor } from "@testing-library/react";
import { beforeEach, expect, test, vi } from "vitest";
import { SWRConfig } from "swr";
import type { ReactNode } from "react";
import { http, HttpResponse } from "msw";

import { renderHook } from "../../../../test-utils/renderHook";
import { server } from "../../../../test-utils/msw/server";
import { useTemplates } from "./useTemplates";

beforeEach(() => {
  vi.clearAllMocks();
});

function wrapSWR({ children }: { children: ReactNode }) {
  return <SWRConfig value={{ provider: () => new Map() }}>{children}</SWRConfig>;
}

test("lists templates and normalizes config fields", async () => {
  server.use(
    http.get("*/v1/templates", () =>
      HttpResponse.json([
        {
          id: 1,
          name: "T1",
          description: "desc",
          is_builtin: true,
          created_at: "2026-01-01",
          config_json: { session_titles: ["A"], output_type: "FAQ", source_tags: ["x"] },
        },
      ]),
    ),
  );

  const { result } = renderHook(() => useTemplates(), { wrapper: wrapSWR });

  await waitFor(() => {
    expect(result.current.templates).toHaveLength(1);
  });

  expect(result.current.templates[0].isBuiltin).toBe(true);
  expect(result.current.templates[0].config.outputType).toBe("FAQ");
  expect(result.current.templates[0].config.sessionTitles).toEqual(["A"]);
  expect(result.current.templates[0].config.sourceTags).toEqual(["x"]);
});

test("saveCurrentNotebookAsTemplate appends new template", async () => {
  server.use(
    http.get("*/v1/templates", () => HttpResponse.json([])),
    http.post("*/v1/notebooks/:notebook_id/templates", async ({ request }) => {
      const body = (await request.json()) as Record<string, unknown>;
      return HttpResponse.json({
        id: 2,
        name: body.name ?? "Saved",
        description: body.description ?? null,
        is_builtin: false,
        created_at: "2026-01-02",
        config_json: { session_titles: [], output_type: "GUIDE", source_tags: [] },
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
      name: "Saved",
      outputType: "GUIDE",
    });
  });

  await waitFor(() => {
    expect(result.current.templates).toHaveLength(1);
  });
  expect(result.current.templates[0].name).toBe("Saved");
});

test("updateTemplateDescription patches and updates list", async () => {
  server.use(
    http.get("*/v1/templates", () =>
      HttpResponse.json([
        {
          id: 3,
          name: "Editable",
          description: "old",
          is_builtin: false,
          created_at: "2026-01-03",
          config_json: { session_titles: [], output_type: null, source_tags: [] },
        },
      ]),
    ),
    http.patch("*/v1/templates/:template_id", async ({ params, request }) => {
      const body = (await request.json()) as Record<string, unknown>;
      return HttpResponse.json({
        id: Number(params.template_id),
        name: "Editable",
        description: body.description ?? "new",
        is_builtin: false,
        created_at: "2026-01-03",
        config_json: { session_titles: [], output_type: null, source_tags: [] },
      });
    }),
  );

  const { result } = renderHook(() => useTemplates(), { wrapper: wrapSWR });

  await waitFor(() => {
    expect(result.current.templates).toHaveLength(1);
  });

  await act(async () => {
    await result.current.updateTemplateDescription(3, "new");
  });

  await waitFor(() => {
    expect(result.current.templates[0].description).toBe("new");
  });
});

test("removeTemplate deletes and removes from list", async () => {
  server.use(
    http.get("*/v1/templates", () =>
      HttpResponse.json([
        {
          id: 4,
          name: "ToDelete",
          description: "",
          is_builtin: false,
          created_at: "2026-01-04",
          config_json: { session_titles: [], output_type: null, source_tags: [] },
        },
      ]),
    ),
    http.delete("*/v1/templates/:template_id", () => HttpResponse.json({})),
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
