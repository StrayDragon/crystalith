/**
 * Lab session port — fixture-only (`VITE_LAB_FIXTURE=1`).
 * Default Lab path uses Eden ResearchRun; UI should prefer this facade over scattering demo store calls.
 */
import {
  createDemoResearchTask,
  listDemoResearchTasks,
  type DemoResearchTask,
  type DemoResearchTaskStatus,
} from './demoResearchTasks';
import { openDemoResearchTask, openNewDemoResearchCompose } from './openDemoResearchTask';

export const LAB_DEFAULT_FIXTURE_SCENARIO_ID = 'xlsx-lib' as const;

export interface LabSessionPort {
  readonly kind: 'fixture';
  /** Product-path fixture id (MUST stay xlsx-lib on c80 main path). */
  readonly defaultScenarioId: typeof LAB_DEFAULT_FIXTURE_SCENARIO_ID;
  listTasks(notebookId?: number | null): DemoResearchTask[];
  createTask(input: {
    notebookId: number;
    topic: string;
    status?: DemoResearchTaskStatus;
    scenarioId?: string;
  }): DemoResearchTask;
  openTask(task: DemoResearchTask): void;
  openCompose(notebookId: number): void;
}

export const fixtureLabSessionPort: LabSessionPort = {
  kind: 'fixture',
  defaultScenarioId: LAB_DEFAULT_FIXTURE_SCENARIO_ID,
  listTasks: listDemoResearchTasks,
  createTask: (input) =>
    createDemoResearchTask({
      ...input,
      scenarioId: input.scenarioId ?? LAB_DEFAULT_FIXTURE_SCENARIO_ID,
    }),
  openTask: openDemoResearchTask,
  openCompose: openNewDemoResearchCompose,
};
