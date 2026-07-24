import { beforeEach, describe, expect, it } from 'vitest';

import {
  countActiveDemoResearchTasks,
  createDemoResearchTask,
  listDemoResearchTasks,
  setActiveDemoResearchTaskId,
  updateDemoResearchTask,
} from './demoResearchTasks';

describe('demoResearchTasks', () => {
  beforeEach(() => {
    sessionStorage.clear();
    setActiveDemoResearchTaskId(null);
  });

  it('creates and lists tasks for a notebook with active badge count', () => {
    createDemoResearchTask({ notebookId: 1, topic: 'A', status: 'running' });
    createDemoResearchTask({ notebookId: 1, topic: 'B', status: 'completed' });
    createDemoResearchTask({ notebookId: 2, topic: 'C', status: 'running' });

    expect(listDemoResearchTasks(1)).toHaveLength(2);
    expect(countActiveDemoResearchTasks(1)).toBe(1);
    expect(countActiveDemoResearchTasks(2)).toBe(1);
  });

  it('updates status for badge', () => {
    const t = createDemoResearchTask({ notebookId: 1, topic: 'X', status: 'running' });
    expect(countActiveDemoResearchTasks(1)).toBe(1);
    updateDemoResearchTask(t.id, { status: 'completed' });
    expect(countActiveDemoResearchTasks(1)).toBe(0);
  });
});
