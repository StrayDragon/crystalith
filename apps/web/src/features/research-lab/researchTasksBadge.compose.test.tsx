import { afterEach, beforeEach, expect, test } from '@rstest/core';
import { act, render, screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';

import { server } from '../../test-utils/msw/server';
import { TestProviders } from '../../test-utils/providers';
import { createResearchRun } from './edenResearchApi';
import { clearResearchTasksCache, refreshResearchTasks } from './researchTasksCache';
import ResearchTasksTrigger from './ResearchTasksTrigger';
import { useResearchTasks } from './useResearchTasks';

// covers: r447
// Lab 已接线 Eden（MSW mock listRuns/POST research）：
// activeCount 为 0 时 Compose 创建 Run 成功后，
// 任务列表 MUST 包含新 Run 且 badge activeCount MUST 相应增加（0 → 1）。

const NID = 9461; // 文件内唯一的 notebookId，避免全局 SWR 缓存串扰
const NEW_RUN_ID = 501;

let runs: Array<Record<string, unknown>> = [];

function runSummary(id: number, status: string): Record<string, unknown> {
  return {
    id,
    notebookId: NID,
    topic: `topic-${id}`,
    status,
    useNotebookSources: false,
    allowWeb: true,
    depth: 'medium',
    maxSearches: 50,
    maxNodes: 60,
    searchesUsed: 0,
    maxPageFetches: 75,
    pagesUsed: 0,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  };
}

beforeEach(() => {
  runs = [];
  server.use(
    http.get(`*/v2/notebooks/${NID}/research`, () =>
      HttpResponse.json({ items: runs, total: runs.length, offset: 0, limit: 50 }),
    ),
    http.post(`*/v2/notebooks/${NID}/research`, async () => {
      const created = runSummary(NEW_RUN_ID, 'queued');
      runs.push(created);
      return HttpResponse.json(created);
    }),
  );
});

afterEach(() => {
  clearResearchTasksCache(NID);
});

function Harness() {
  const { tasks } = useResearchTasks(NID);
  return (
    <>
      <ResearchTasksTrigger notebookId={NID} onOpen={() => {}} />
      <ul>
        {tasks.map((task) => (
          <li key={task.id}>{`run-${task.id}-${task.status}`}</li>
        ))}
      </ul>
    </>
  );
}

test('compose create increments badge activeCount from 0 to 1', async () => {
  render(
    <TestProviders>
      <Harness />
    </TestProviders>,
  );

  // 初始 activeCount = 0：无 badge，触发按钮为「深度研究」。
  await waitFor(() => {
    expect(screen.getByRole('button', { name: '深度研究' })).toBeTruthy();
  });
  expect(screen.queryByTestId('research-tasks-badge')).toBeNull();

  // Compose 创建成功路径（与 composeAndStart 一致）：POST 创建 + mutate 刷新任务列表。
  await act(async () => {
    const created = await createResearchRun(NID, { topic: '量子纠错' });
    expect(created.id).toBe(NEW_RUN_ID);
    refreshResearchTasks(NID);
  });

  // 任务列表包含新 Run 且 badge activeCount 0 → 1。
  await waitFor(() => {
    expect(screen.getByText(`run-${NEW_RUN_ID}-queued`)).toBeTruthy();
  });
  await waitFor(() => {
    expect(screen.getByRole('button', { name: `深度研究任务（1 进行中）` })).toBeTruthy();
  });
  expect(screen.getByTestId('research-tasks-badge').textContent).toBe('1');
});
