/** Fixture Lab mode — default OFF (Eden ResearchRun is authority). */
export function isLabFixtureMode(): boolean {
  return import.meta.env.VITE_LAB_FIXTURE === '1';
}
