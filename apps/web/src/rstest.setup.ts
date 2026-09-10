import { afterAll, afterEach, beforeAll, expect } from '@rstest/core';
// jest-dom adds custom jest matchers for asserting on DOM nodes.
// allows you to do things like:
// expect(element).toHaveTextContent(/react/i)
// learn more: https://github.com/testing-library/jest-dom
/* eslint-disable eslint/max-classes-per-file */
// Prefer explicit expect.extend: jest-dom's `@testing-library/jest-dom/vitest`
// entry uses CJS `require('vitest')`, which can extend a different expect
// instance than the ESM one under Bun (→ Invalid Chai property: toBeInTheDocument).
import * as matchers from '@testing-library/jest-dom/matchers';

import { server } from './test-utils/msw/server';

expect.extend(matchers);

beforeAll(() => {
  const onUnhandledRequest = (process.env.RSTEST_MSW_ON_UNHANDLED || 'error') as
    | 'bypass'
    | 'warn'
    | 'error';
  server.listen({ onUnhandledRequest });
});

afterEach(() => {
  server.resetHandlers();
});

afterAll(() => {
  server.close();
});

if (!Element.prototype.animate) {
  Element.prototype.animate = () =>
    ({
      cancel: () => {},
      finished: Promise.resolve(),
    }) as unknown as Animation;
}

if (typeof window !== 'undefined' && !window.ResizeObserver) {
  window.ResizeObserver = class ResizeObserver {
    observe() {}

    unobserve() {}

    disconnect() {}
  };
}

if (typeof window !== 'undefined' && !window.IntersectionObserver) {
  (window.IntersectionObserver as unknown) = class {
    readonly root = null;

    readonly rootMargin = '0px';

    readonly thresholds: ReadonlyArray<number> = [0];

    readonly scrollMargin = '0px';

    disconnect() {}

    observe() {}

    takeRecords() {
      return [];
    }

    unobserve() {}
  };
}

if (typeof URL !== 'undefined' && !('createObjectURL' in URL)) {
  // Some optional dependencies (e.g. media encoder helpers) expect these to exist.
  // jsdom does not implement them by default.
  (URL as unknown as { createObjectURL: (blob: Blob) => string }).createObjectURL = () =>
    'blob:rstest-mock';
  (URL as unknown as { revokeObjectURL: (url: string) => void }).revokeObjectURL = () => {};
}

if (typeof window !== 'undefined' && !window.Worker) {
  window.Worker = class Worker {
    postMessage() {}

    terminate() {}

    addEventListener() {}

    removeEventListener() {}

    dispatchEvent() {
      return false;
    }
  } as unknown as typeof Worker;
}
