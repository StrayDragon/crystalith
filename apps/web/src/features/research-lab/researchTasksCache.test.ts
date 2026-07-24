import { beforeEach, describe, expect, it, vi } from 'vitest';

// Mock reason: isolate SWR global mutate so cache helpers stay unit-testable without a provider.
const { mutateMock } = vi.hoisted(() => ({
  mutateMock: vi.fn(() => Promise.resolve(undefined)),
}));

// Mock reason: replace swr.mutate with the hoisted spy for assertion.
vi.mock('swr', () => ({
  mutate: mutateMock,
}));

import {
  clearResearchTasksCache,
  refreshResearchTasks,
  researchTasksSwrKey,
} from './researchTasksCache';
import { isActiveResearchStatus } from './researchTaskTypes';

describe('researchTasksCache', () => {
  beforeEach(() => {
    mutateMock.mockClear();
  });

  it('refreshResearchTasks mutates the notebook key', () => {
    refreshResearchTasks(62);
    expect(mutateMock).toHaveBeenCalledWith(researchTasksSwrKey(62));
  });

  it('refreshResearchTasks no-ops for invalid notebookId', () => {
    refreshResearchTasks(0);
    expect(mutateMock).not.toHaveBeenCalled();
  });

  it('clearResearchTasksCache drops cache without revalidate', () => {
    clearResearchTasksCache(9);
    expect(mutateMock).toHaveBeenCalledWith(researchTasksSwrKey(9), undefined, {
      revalidate: false,
    });
  });
});

describe('isActiveResearchStatus', () => {
  it('counts only non-terminal run statuses', () => {
    expect(isActiveResearchStatus('queued')).toBe(true);
    expect(isActiveResearchStatus('running')).toBe(true);
    expect(isActiveResearchStatus('awaiting_confirm')).toBe(true);
    expect(isActiveResearchStatus('completed')).toBe(false);
    expect(isActiveResearchStatus('failed')).toBe(false);
    expect(isActiveResearchStatus('cancelled')).toBe(false);
  });
});
