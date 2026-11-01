// covers: r387（workspace-ui-core）——顶栏挂载后 notebook 切换器、布局锁定开关与中间搜索/调研入口三个关键入口可见可用。
import { beforeEach, expect, test, rs } from '@rstest/core';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import type { ComponentProps } from 'react';

import { TestIds } from '../../../shared/testids';
import { server } from '../../../test-utils/msw/server';
import { TestProviders } from '../../../test-utils/providers';
import WorkspaceHeader from './WorkspaceHeader';

const NOTEBOOK_ID = 387;
const NOTEBOOKS = [
  { id: NOTEBOOK_ID, title: '顶栏测试笔记本', updatedAt: '2026-01-01T00:00:00Z' },
  { id: 388, title: '另一本笔记本', updatedAt: '2026-01-02T00:00:00Z' },
];

beforeEach(() => {
  // ResearchTasksTrigger / ResearchTasksDrawer 经 Eden 拉取研究任务列表；
  // NotebookSwitcher 的模板流程会预取模板列表
  server.use(
    http.get(`*/v2/notebooks/${NOTEBOOK_ID}/research`, () =>
      HttpResponse.json({ items: [], total: 0 }),
    ),
    http.get('*/v2/templates', () => HttpResponse.json([])),
  );
});

function renderHeader(overrides: Partial<ComponentProps<typeof WorkspaceHeader>> = {}) {
  return render(
    <TestProviders>
      <WorkspaceHeader
        notebooks={NOTEBOOKS}
        activeNotebookId={NOTEBOOK_ID}
        isNotebooksLoading={false}
        notebooksError=""
        createName=""
        createState="idle"
        createError=""
        isConnected={true}
        onCreateNameChange={rs.fn()}
        onCreateNotebook={rs.fn(async () => true)}
        onSelectNotebook={rs.fn()}
        locked={false}
        onToggleLock={rs.fn()}
        topbarSearch={
          <button type="button" data-testid={TestIds.topbarSearchTrigger}>
            搜索 / 调研
          </button>
        }
        {...overrides}
      />
    </TestProviders>,
  );
}

test('header mounts with notebook switcher, layout lock and topbar search entries', async () => {
  renderHeader();
  // 等 SWR（研究任务列表）解析完成，避免断言与异步状态更新竞态
  await act(async () => {});

  expect(screen.getByTestId(TestIds.workspaceHeader)).toBeVisible();
  // notebook 切换器可见，且显示当前 notebook 标题
  const switcher = screen.getByTestId(TestIds.notebookSwitcherTrigger);
  expect(switcher).toBeVisible();
  expect(switcher).toHaveTextContent('顶栏测试笔记本');
  // 布局锁定开关可见
  expect(screen.getByTestId(TestIds.layoutLockToggle)).toBeVisible();
  // 顶栏中间的搜索/调研输入入口可见
  expect(screen.getByTestId(TestIds.topbarSearchTrigger)).toBeVisible();
});

test('layout lock toggle reflects lock state and fires on toggle click', async () => {
  const onToggleLock = rs.fn();
  renderHeader({ locked: true, onToggleLock });
  await act(async () => {});

  const toggle = screen.getByTestId(TestIds.layoutLockToggle);
  expect(toggle).toHaveAttribute('aria-label', '解锁布局');

  fireEvent.click(toggle);
  expect(onToggleLock).toHaveBeenCalledTimes(1);
});
