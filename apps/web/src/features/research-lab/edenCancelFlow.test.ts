import { beforeEach, describe, expect, it, vi } from 'vitest';

const cancelResearchRun = vi.hoisted(() => vi.fn());
const refreshResearchTasks = vi.hoisted(() => vi.fn());

// Mock reason: stub Eden cancel POST so the flow unit-tests refresh without HTTP.
vi.mock('./edenResearchApi', () => ({
  cancelResearchRun,
}));

// Mock reason: assert inbox refresh is invoked after successful cancel (r425/r426).
vi.mock('./researchTasksCache', () => ({
  refreshResearchTasks,
}));

import { cancelActiveEdenRun } from './edenCancelFlow';

describe('cancelActiveEdenRun', () => {
  beforeEach(() => {
    cancelResearchRun.mockReset();
    refreshResearchTasks.mockReset();
  });

  it('calls cancelResearchRun then refreshResearchTasks', async () => {
    const cancelled = {
      id: 9,
      notebookId: 62,
      status: 'cancelled',
      topic: 't',
      nodes: [],
      edges: [],
    };
    cancelResearchRun.mockResolvedValue(cancelled);

    const next = await cancelActiveEdenRun(62, 9);

    expect(cancelResearchRun).toHaveBeenCalledWith(62, 9);
    expect(refreshResearchTasks).toHaveBeenCalledWith(62);
    expect(next).toEqual(cancelled);
  });

  it('does not refresh when cancel fails', async () => {
    cancelResearchRun.mockRejectedValue(new Error('cancel failed'));

    await expect(cancelActiveEdenRun(62, 9)).rejects.toThrow('cancel failed');
    expect(refreshResearchTasks).not.toHaveBeenCalled();
  });
});
