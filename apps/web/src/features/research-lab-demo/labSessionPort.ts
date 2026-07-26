/**
 * Lab session port — Demo Lab only (`/demo/research-lab`, DEV || VITE_LAB_DEMO=1).
 * Product `/research-lab` uses Eden ResearchRun; MUST NOT use this port.
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
  /** Demo-path fixture scenario id (xlsx-lib walkthrough). */
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
