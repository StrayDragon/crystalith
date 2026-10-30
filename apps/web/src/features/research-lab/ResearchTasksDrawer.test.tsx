// covers: r450（deep-research-ui）——任务抽屉 awaiting_confirm 行取消经命令口成功且行 status 显示 cancelled。
import { afterEach, beforeEach, expect, test } from '@rstest/core';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';

import { server } from '../../test-utils/msw/server';
import { TestProviders } from '../../test-utils/providers';
import { cancelActiveEdenRun } from './edenCancelFlow';
import { clearResearchTasksCache } from './researchTasksCache';
import ResearchTasksDrawer from './ResearchTasksDrawer';

const NID = 5177; // 文件内唯一 notebookId，避免全局 SWR 缓存串扰
const RID = 311;

let runs: Array<Record<string, unknown>> = [];
let cancelCalls = 0;

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
  cancelCalls = 0;
  runs = [runSummary(RID, 'awaiting_confirm')];
  server.use(
    http.get(`*/v2/notebooks/${NID}/research`, () =>
      HttpResponse.json({ items: runs, total: runs.length, offset: 0, limit: 50 }),
    ),
    http.post(`*/v2/notebooks/${NID}/research/${RID}/cancel`, () => {
      cancelCalls += 1;
      runs = [runSummary(RID, 'cancelled')];
      return HttpResponse.json({
        ...runSummary(RID, 'cancelled'),
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

test('drawer row cancel posts command port and row shows cancelled', async () => {
  render(
    <TestProviders>
      <ResearchTasksDrawer
        open
        notebookId={NID}
        onClose={() => {}}
        onSelectTask={() => {}}
        onCancelTask={(task) => {
          // 与 ResearchLabPage 接线一致：经取消命令口 POST 并刷新任务列表。
          void cancelActiveEdenRun(NID, Number(task.id));
        }}
      />
    </TestProviders>,
  );

  // 初始行：awaiting_confirm → 「待确认」，且提供行取消入口。
  const row = await screen.findByTestId('research-tasks-item');
  expect(row.textContent).toContain('待确认');
  expect(screen.getByRole('button', { name: '取消研究' })).toBeTruthy();

  // 行取消按钮 → ConfirmPopover 二次确认 → 取消命令口。
  fireEvent.click(screen.getByRole('button', { name: '取消研究' }));
  fireEvent.click(screen.getByTestId('confirm-popover-confirm'));

  // 取消经 POST …/research/:rid/cancel 成功（恰好一次）。
  await waitFor(() => {
    expect(cancelCalls).toBe(1);
  });

  // 刷新后列表行 status 显示 cancelled（「已取消」），终态行不再提供取消入口。
  await waitFor(() => {
    expect(screen.getByTestId('research-tasks-item').textContent).toContain('已取消');
  });
  await waitFor(() => {
    expect(screen.queryByRole('button', { name: '取消研究' })).toBeNull();
  });
});
