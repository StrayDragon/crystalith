import { afterEach, beforeEach, expect, rs, test } from '@rstest/core';
import { act, render, screen } from '@testing-library/react';

import { LayerProvider } from '../layer';
import { CoachMarkCountdown, CoachMarkPopover } from './CoachMarkPopover';

// Mock reason: fake timers make autoDismissMs / countdown ticks deterministic without wall-clock drift.
beforeEach(() => {
  rs.useFakeTimers();
});

afterEach(() => {
  rs.useRealTimers();
});

test('CoachMarkPopover auto-dismisses after autoDismissMs and runs onAutoDismiss before onDismiss', () => {
  let dismissCount = 0;
  let autoDismissCount = 0;

  render(
    <LayerProvider>
      <CoachMarkPopover
        open
        onDismiss={() => {
          dismissCount += 1;
        }}
        onAutoDismiss={() => {
          autoDismissCount += 1;
        }}
        autoDismissMs={10_000}
        anchor={<button type="button">anchor</button>}
      >
        <span>coach mark</span>
      </CoachMarkPopover>
    </LayerProvider>,
  );

  expect(screen.getByText('coach mark')).toBeTruthy();
  expect(autoDismissCount).toBe(0);
  expect(dismissCount).toBe(0);

  act(() => {
    rs.advanceTimersByTime(10_000);
  });

  expect(autoDismissCount).toBe(1);
  expect(dismissCount).toBe(1);
});

test('CoachMarkCountdown renders live seconds when showAutoDismissCountdown is enabled', () => {
  render(
    <LayerProvider>
      <CoachMarkPopover
        open
        onDismiss={() => undefined}
        autoDismissMs={10_000}
        showAutoDismissCountdown
        countdownActionId="primary"
        anchor={<button type="button">anchor</button>}
      >
        <CoachMarkCountdown actionId="primary" />
      </CoachMarkPopover>
    </LayerProvider>,
  );

  expect(screen.getByText('10s')).toBeTruthy();

  act(() => {
    rs.advanceTimersByTime(1_250);
  });

  expect(screen.getByText('9s')).toBeTruthy();
});
