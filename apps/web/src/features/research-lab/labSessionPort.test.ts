import { beforeEach, describe, expect, it } from 'vitest';

import { setActiveDemoResearchTaskId } from './demoResearchTasks';
import { fixtureLabSessionPort, LAB_DEFAULT_FIXTURE_SCENARIO_ID } from './labSessionPort';

describe('fixtureLabSessionPort', () => {
  beforeEach(() => {
    sessionStorage.clear();
    setActiveDemoResearchTaskId(null);
  });

  it('locks product-path default scenario to xlsx-lib', () => {
    expect(fixtureLabSessionPort.kind).toBe('fixture');
    expect(fixtureLabSessionPort.defaultScenarioId).toBe('xlsx-lib');
    expect(LAB_DEFAULT_FIXTURE_SCENARIO_ID).toBe('xlsx-lib');
  });

  it('creates tasks with default fixture scenario', () => {
    const task = fixtureLabSessionPort.createTask({ notebookId: 9, topic: 'xlsx' });
    expect(task.scenarioId).toBe('xlsx-lib');
    expect(fixtureLabSessionPort.listTasks(9)).toHaveLength(1);
  });
});
