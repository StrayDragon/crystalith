/**
 * Demo Lab gate — DEV always on; production only when VITE_LAB_DEMO=1.
 * MUST NOT divert product `/research-lab` (c103 / r456–r457).
 * Legacy `VITE_LAB_FIXTURE` is ignored for product authority.
 */
export function isLabDemoMode(): boolean {
  return import.meta.env.DEV || import.meta.env.VITE_LAB_DEMO === '1';
}
