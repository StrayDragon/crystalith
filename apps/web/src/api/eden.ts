import type { App } from '@crystalith/server';
// Eden treaty client — zero-codegen type-safe RPC to the v2 server.
//
// Usage:
//   const { data } = await api.v2.notebooks.get();
//   const { data: created } = await api.v2.notebooks.post({ name: "My Notebook" });
//
// The `App` type is imported from @crystalith/server, giving full autocomplete
// + compile-time validation on every path/body/response.
import { treaty } from '@elysiajs/eden';

const baseUrl =
  (import.meta as unknown as { env?: Record<string, string> }).env?.VITE_API_BASE_URL ??
  'http://localhost:8032';

export const api = treaty<App>(baseUrl);

export type { App };
