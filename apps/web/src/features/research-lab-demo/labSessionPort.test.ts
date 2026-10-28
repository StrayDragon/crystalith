import { beforeEach, describe, expect, it } from '@rstest/core';

import { setActiveDemoResearchTaskId } from './demoResearchTasks';
import { fixtureLabSessionPort, LAB_DEFAULT_FIXTURE_SCENARIO_ID } from './labSessionPort';

describe('fixtureLabSessionPort', () => {
  beforeEach(() => {
    sessionStorage.clear();
    setActiveDemoResearchTaskId(null);
  });

  it('is a fixture port whose createTask stamps the default scenario and delegates listing', () => {
    expect(fixtureLabSessionPort.kind).toBe('fixture');
    const task = fixtureLabSessionPort.createTask({ notebookId: 9, topic: 'xlsx' });
    expect(task.scenarioId).toBe(LAB_DEFAULT_FIXTURE_SCENARIO_ID);
    expect(fixtureLabSessionPort.listTasks(9)).toHaveLength(1);
  });
});
