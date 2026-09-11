/**
 * Demo Lab gate — DEV always on; production only when VITE_LAB_DEMO=1.
 * MUST NOT divert product `/research-lab` (c103 / r456–r457).
 * Legacy `VITE_LAB_FIXTURE` is ignored for product authority.
 *
 * `env` is injectable for tests: under Rstest `import.meta.env` is a
 * build-time define, so runtime stubbing cannot exercise the branches.
 */
export function isLabDemoMode(
  env: {
    readonly DEV?: boolean;
    readonly VITE_LAB_DEMO?: string;
  } = import.meta.env,
): boolean {
  return env.DEV || env.VITE_LAB_DEMO === '1';
}
