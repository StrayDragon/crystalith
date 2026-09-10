import { beforeEach, describe, expect, it } from '@rstest/core';

import {
  consumeLabRunNeedsReload,
  markLabRunNeedsReload,
  peekLabRunNeedsReload,
} from './labRunReloadGate';

describe('labRunReloadGate (c98)', () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  it('marks and consumes for matching nid/rid', () => {
    markLabRunNeedsReload(1, 9);
    expect(peekLabRunNeedsReload(1, 9)).toBe(true);
    expect(peekLabRunNeedsReload(1, 8)).toBe(false);
    expect(consumeLabRunNeedsReload(1, 9)).toBe(true);
    expect(consumeLabRunNeedsReload(1, 9)).toBe(false);
  });
});
