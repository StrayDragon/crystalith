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

/**
 * API base URL:
 * - Browser: routes through Vite proxy (same-origin, default '')
 * - Override via VITE_API_BASE_URL env
 *
 * Note: In development, the Vite proxy at :3000 forwards /v1, /v2 etc. to :8032.
 * Eden treaty with empty baseUrl generates relative paths that resolve to the
 * current page origin, which goes through the Vite proxy.
 */
function getBaseUrl(): string {
  if (typeof window !== 'undefined') {
    // Browser: use same origin (Vite proxy handles forwarding in dev)
    return window.location.origin;
  }
  // Server-side or env override
  return (
    (import.meta as unknown as { env?: Record<string, string> }).env?.VITE_API_BASE_URL ??
    'http://localhost:8032'
  );
}

const baseUrl = getBaseUrl();

export const api = treaty<App>(baseUrl);

export type { App };
