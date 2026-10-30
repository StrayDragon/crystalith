// covers: r103（deep-research-ui）——Run 详情按 runStatus 切换主表面：非终态研究图为主可交互且报告折叠；completed 报告为主入口、图降只读次级；failed/cancelled 状态说明为主、图只读。
import { afterAll, beforeAll, describe, expect, it, rs } from '@rstest/core';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';

import * as streamActual from '../../api/stream' with { rstest: 'importActual' };
import { server } from '../../test-utils/msw/server';
import { TestProvidersWithSWR } from '../../test-utils/providers';
import * as labRoutingActual from './labRouting' with { rstest: 'importActual' };

const navigateToLabReport = rs.hoisted(() => rs.fn());

// Mock reason: 挂起 Run SSE 事件流 —— 表面切换测试只依赖 GET Run 状态，不消费真实 SSE。
rs.mock('../../api/stream', () => ({
  ...streamActual,
  streamRequest: rs.fn(async function* () {
    await new Promise(() => undefined);
    yield undefined as never;
  }),
}));

// Mock reason: 捕获「查看报告」主导航而不真正改写 jsdom history（其余路由工具保持原实现）。
rs.mock('./labRouting', () => ({
  ...labRoutingActual,
  navigateToLabReport: (...args: unknown[]) => navigateToLabReport(...args),
}));

import ResearchLabPage from './ResearchLabPage';

const NID = 7103; // 文件内唯一 notebookId，避免全局 SWR 缓存串扰
const RID = 9103;

// jsdom reports zero element dimensions; xyflow renders edges only once nodes are
// measured（与 LabGraph.keyboard.test.tsx 相同的测量仿真）。
const cardWidth = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'offsetWidth');
const cardHeight = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'offsetHeight');
const originalRO = window.ResizeObserver;
const originalDOMMatrix = window.DOMMatrixReadOnly;

beforeAll(() => {
  Object.defineProperty(HTMLElement.prototype, 'offsetWidth', {
    configurable: true,
    get: () => 220,
  });
  Object.defineProperty(HTMLElement.prototype, 'offsetHeight', {
    configurable: true,
    get: () => 64,
  });
  if (window.DOMMatrixReadOnly === undefined) {
    class FakeDOMMatrix {
      m11 = 1;
      m12 = 0;
      m21 = 0;
      m22 = 1;
      m41 = 0;
      m42 = 0;
      a = 1;
      b = 0;
      c = 0;
      d = 1;
      e = 0;
      f = 0;

      constructor(public readonly init?: string | number[]) {}
    }
    window.DOMMatrixReadOnly = FakeDOMMatrix as unknown as typeof DOMMatrixReadOnly;
  }
  class MeasuringRO {
    private cb: ResizeObserverCallback;

    constructor(cb: ResizeObserverCallback) {
      this.cb = cb;
    }

    observe(el: Element) {
      queueMicrotask(() =>
        this.cb(
          [
            {
              target: el,
              contentRect: {
                width: 220,
                height: 64,
                x: 0,
                y: 0,
                top: 0,
                left: 0,
                bottom: 64,
                right: 220,
                toJSON: () => '',
              },
            } as ResizeObserverEntry,
          ],
          this as unknown as ResizeObserver,
        ),
      );
    }

    unobserve() {}

    disconnect() {}
  }
  window.ResizeObserver = MeasuringRO as unknown as typeof ResizeObserver;
});

afterAll(() => {
  if (cardWidth) Object.defineProperty(HTMLElement.prototype, 'offsetWidth', cardWidth);
  if (cardHeight) Object.defineProperty(HTMLElement.prototype, 'offsetHeight', cardHeight);
  window.ResizeObserver = originalRO;
  window.DOMMatrixReadOnly = originalDOMMatrix;
  window.history.replaceState({}, '', '/');
});

function mkRun(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: RID,
    notebookId: NID,
    topic: '拓扑绝缘体综述',
    status: 'running',
    useNotebookSources: false,
    allowWeb: true,
    depth: 'medium',
    maxSearches: 50,
    maxNodes: 60,
    searchesUsed: 3,
    maxPageFetches: 75,
    pagesUsed: 0,
    nodes: [
      { id: 'node_root_1', title: '主问题', role: 'question', conclusionStatus: 'pending' },
      {
        id: 'node_research_a',
        title: '支路A',
        role: 'research',
        conclusionStatus: 'pending',
        evidenceIds: [],
      },
      { id: 'node_conclusion_1', title: '结论', role: 'conclusion', conclusionStatus: 'pending' },
    ],
    edges: [
      { id: 'e_root_a', source: 'node_root_1', target: 'node_research_a', kind: 'expand' },
      {
        id: 'e_a_conc',
        source: 'node_research_a',
        target: 'node_conclusion_1',
        kind: 'merge',
        labelNote: '汇入',
      },
    ],
    evidences: [],
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

function mountPage(run: Record<string, unknown>) {
  window.history.replaceState({}, '', `/research-lab/${NID}?rid=${RID}`);
  server.use(
    http.get(`*/v2/notebooks/${NID}/research/${RID}`, () => HttpResponse.json(run)),
    http.get(`*/v2/notebooks/${NID}/research/${RID}/progress`, () =>
      HttpResponse.json({ items: [], nextAfterSeq: 0 }),
    ),
    http.get(`*/v2/notebooks/${NID}/research`, () =>
      HttpResponse.json({ items: [], total: 0, offset: 0, limit: 50 }),
    ),
  );
  return render(
    <TestProvidersWithSWR>
      <ResearchLabPage notebookId={NID} />
    </TestProvidersWithSWR>,
  );
}

describe('ResearchLabPage status-driven primary surface (r103)', () => {
  it('running: graph is the primary interactive surface; report draft stays folded', async () => {
    mountPage(mkRun());
    await screen.findByText('支路A');

    // 研究图为主且非只读：边上的剪枝/fork 入口可用。
    expect(screen.getByRole('button', { name: '剪枝' })).toBeTruthy();
    expect(screen.getByRole('button', { name: '分叉' })).toBeTruthy();
    // 非终态主操作是取消研究（status-driven），不出现报告主入口。
    expect(screen.getByRole('button', { name: '取消研究' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: '查看报告' })).toBeNull();
    // 报告草稿默认折叠：报告内容与报告导出入口均不渲染。
    expect(screen.queryByText('拓扑绝缘体综述报告')).toBeNull();
    expect(screen.queryByText('导出建议报告')).toBeNull();
    // 不回退到 Compose 新建面。
    expect(screen.queryByTestId('research-lab-compose')).toBeNull();
  });

  it('completed: report is the primary entry; graph demoted to read-only secondary', async () => {
    navigateToLabReport.mockReset();
    mountPage(
      mkRun({
        status: 'completed',
        report: { title: '拓扑绝缘体综述报告', sections: [], citations: {} },
      }),
    );
    await screen.findByText('支路A');

    // 图降为只读次级：剪枝/fork 边入口消失，末次图仍可见。
    expect(screen.getByText('支路A')).toBeTruthy();
    expect(screen.queryByRole('button', { name: '剪枝' })).toBeNull();
    expect(screen.queryByRole('button', { name: '分叉' })).toBeNull();
    // completed 状态说明：结论节点标「综述就绪」。
    expect(screen.getByText('打开节点详情 · 综述就绪')).toBeTruthy();

    // 报告为主：主操作「查看报告」导航到报告页。
    fireEvent.click(screen.getByRole('button', { name: '查看报告' }));
    await waitFor(() => {
      expect(navigateToLabReport).toHaveBeenCalledWith(NID, RID);
    });
    // 报告相关入口（导出建议报告）在 completed 下可见。
    expect(screen.getByText('导出建议报告')).toBeTruthy();
  });

  it('cancelled: status note leads; last graph stays read-only; no report entry', async () => {
    mountPage(mkRun({ status: 'cancelled' }));
    await screen.findByText('支路A');

    // 状态说明为主：结论节点标「已取消」，主操作是重试。
    expect(screen.getByText('打开节点详情 · 已取消')).toBeTruthy();
    expect(screen.getByRole('button', { name: '重试' })).toBeTruthy();
    // 末次图保留但只读：无剪枝/fork 边入口。
    expect(screen.queryByRole('button', { name: '剪枝' })).toBeNull();
    expect(screen.queryByRole('button', { name: '分叉' })).toBeNull();
    // 无报告（cancelled 不展示报告）。
    expect(screen.queryByRole('button', { name: '查看报告' })).toBeNull();
    expect(screen.queryByText('导出建议报告')).toBeNull();
  });

  it('failed: status note leads with failed phase label; graph read-only', async () => {
    mountPage(mkRun({ status: 'failed', failureReason: '检索通道不可用' }));
    await screen.findByText('支路A');

    // 状态说明为主：进度条 phase 标签「失败」（headline 回退同文案）、结论节点标「失败」。
    const progress = screen.getByTestId('research-lab-progress');
    expect(within(progress).getAllByText('失败').length).toBeGreaterThan(0);
    expect(screen.getByText('打开节点详情 · 失败')).toBeTruthy();
    // 图只读：无剪枝/fork 边入口；主操作是重试。
    expect(screen.queryByRole('button', { name: '剪枝' })).toBeNull();
    expect(screen.getByRole('button', { name: '重试' })).toBeTruthy();
  });
});
