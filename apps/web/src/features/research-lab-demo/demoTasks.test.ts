import { beforeEach, describe, expect, it } from '@rstest/core';
// demo 任务面合并测试：fake 任务存储 + fixture 端口默认场景戳。
// （原 demoResearchTasks / labSessionPort 两个碎片文件收敛于此。）

import {
  countActiveDemoResearchTasks,
  createDemoResearchTask,
  listDemoResearchTasks,
  setActiveDemoResearchTaskId,
  updateDemoResearchTask,
} from './demoResearchTasks';
import { fixtureLabSessionPort, LAB_DEFAULT_FIXTURE_SCENARIO_ID } from './labSessionPort';

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

describe('fixtureLabSessionPort', () => {
  beforeEach(() => {
    sessionStorage.clear();
    setActiveDemoResearchTaskId(null);
  });

  it('is a fixture port whose createTask stamps the default scenario and delegates listing', () => {
    // 常量自比较之外钉死字面量：demo 默认场景 id 改值（如换演示数据集）必须显式过测试。
    expect(LAB_DEFAULT_FIXTURE_SCENARIO_ID).toBe('xlsx-lib');
    expect(fixtureLabSessionPort.kind).toBe('fixture');
    const task = fixtureLabSessionPort.createTask({ notebookId: 9, topic: 'xlsx' });
    expect(task.scenarioId).toBe(LAB_DEFAULT_FIXTURE_SCENARIO_ID);
    expect(fixtureLabSessionPort.listTasks(9)).toHaveLength(1);
  });
});
