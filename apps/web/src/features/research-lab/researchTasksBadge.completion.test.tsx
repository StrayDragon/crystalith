// covers: r448（deep-research-ui）——awaiting_confirm Run 经 confirm 变 completed 后任务列表 status 更新且 badge activeCount 归零。
import { afterEach, beforeEach, expect, test } from '@rstest/core';
import { act, render, screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';

import { server } from '../../test-utils/msw/server';
import { TestProviders } from '../../test-utils/providers';
import { confirmResearchRun } from './edenResearchApi';
import { clearResearchTasksCache, refreshResearchTasks } from './researchTasksCache';
import ResearchTasksTrigger from './ResearchTasksTrigger';
import { useResearchTasks } from './useResearchTasks';

// 任务列表存在 awaiting_confirm Run：用户 confirm（finish_report）成功并刷新后，
// 任务列表 status 更新为 completed 且 badge activeCount 归零（MSW mock listRuns/confirm）。

const NID = 9463; // 文件内唯一 notebookId，避免全局 SWR 缓存串扰
const RID = 771;

let runs: Array<Record<string, unknown>> = [];
let confirmCalls = 0;

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
  confirmCalls = 0;
  runs = [runSummary(RID, 'awaiting_confirm')];
  server.use(
    http.get(`*/v2/notebooks/${NID}/research`, () =>
      HttpResponse.json({ items: runs, total: runs.length, offset: 0, limit: 50 }),
    ),
    http.post(`*/v2/notebooks/${NID}/research/${RID}/confirm`, () => {
      confirmCalls += 1;
      runs = [runSummary(RID, 'completed')];
      return HttpResponse.json({
        ...runSummary(RID, 'completed'),
        nodes: [],
        edges: [],
        evidences: [],
      });
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

test('confirm completes awaiting run and clears badge activeCount', async () => {
  render(
    <TestProviders>
      <Harness />
    </TestProviders>,
  );

  // 初始：awaiting_confirm 计入 activeCount → badge 显示 1。
  await waitFor(() => {
    expect(screen.getByText(`run-${RID}-awaiting_confirm`)).toBeTruthy();
  });
  expect(screen.getByTestId('research-tasks-badge').textContent).toBe('1');

  // 用户 confirm 成功后刷新任务列表（与 controller finishReport→refresh 接线一致）。
  await act(async () => {
    await confirmResearchRun(NID, RID, { action: 'finish_report' });
    refreshResearchTasks(NID);
  });

  // 任务列表 status 更新为 completed，badge activeCount 归零。
  await waitFor(() => {
    expect(screen.getByText(`run-${RID}-completed`)).toBeTruthy();
  });
  expect(screen.queryByTestId('research-tasks-badge')).toBeNull();
  expect(screen.getByRole('button', { name: '深度研究' })).toBeTruthy();
  expect(confirmCalls).toBe(1);
});
