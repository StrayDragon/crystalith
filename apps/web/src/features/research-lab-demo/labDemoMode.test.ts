import { afterEach, describe, expect, it, vi } from 'vitest';

describe('isLabDemoMode (r457)', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it('is true when VITE_LAB_DEMO=1 even if not DEV', async () => {
    vi.stubEnv('DEV', false);
    vi.stubEnv('VITE_LAB_DEMO', '1');
    const { isLabDemoMode } = await import('./labDemoMode');
    expect(isLabDemoMode()).toBe(true);
  });

  it('is false in production without VITE_LAB_DEMO', async () => {
    vi.stubEnv('DEV', false);
    vi.stubEnv('VITE_LAB_DEMO', '');
    const { isLabDemoMode } = await import('./labDemoMode');
    expect(isLabDemoMode()).toBe(false);
  });

  it('ignores legacy VITE_LAB_FIXTURE for demo gate', async () => {
    vi.stubEnv('DEV', false);
    vi.stubEnv('VITE_LAB_DEMO', '');
    vi.stubEnv('VITE_LAB_FIXTURE', '1');
    const { isLabDemoMode } = await import('./labDemoMode');
    expect(isLabDemoMode()).toBe(false);
  });
});
