import { describe, expect, it } from '@rstest/core';

import { isLabDemoMode } from './labDemoMode';

// `import.meta.env.DEV` is a build-time constant under Rstest (define) and
// cannot be stubbed at runtime, so branch coverage comes from injecting the
// env object; the DEV default stays the compile-time environment constant.
describe('isLabDemoMode (r457)', () => {
  it('is true when VITE_LAB_DEMO=1 even if not DEV', () => {
    expect(isLabDemoMode({ DEV: false, VITE_LAB_DEMO: '1' })).toBe(true);
  });

  it('is false in production without VITE_LAB_DEMO', () => {
    expect(isLabDemoMode({ DEV: false, VITE_LAB_DEMO: '' })).toBe(false);
    expect(isLabDemoMode({ DEV: false })).toBe(false);
  });

  it('is true when DEV (demo always on in dev builds)', () => {
    expect(isLabDemoMode({ DEV: true })).toBe(true);
    expect(isLabDemoMode({ DEV: true, VITE_LAB_DEMO: '' })).toBe(true);
  });

  it('ignores legacy VITE_LAB_FIXTURE for demo gate', () => {
    expect(isLabDemoMode({ DEV: false, VITE_LAB_FIXTURE: '1' } as never)).toBe(false);
  });
});
