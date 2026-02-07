// jest-dom adds custom jest matchers for asserting on DOM nodes.
// allows you to do things like:
// expect(element).toHaveTextContent(/react/i)
// learn more: https://github.com/testing-library/jest-dom
import '@testing-library/jest-dom/vitest';

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
  } as typeof ResizeObserver;
}

if (typeof window !== 'undefined' && !window.IntersectionObserver) {
  window.IntersectionObserver = class IntersectionObserver {
    readonly root = null;

    readonly rootMargin = '0px';

    readonly thresholds = [0];

    disconnect() {}

    observe() {}

    takeRecords() {
      return [];
    }

    unobserve() {}
  } as typeof IntersectionObserver;
}
