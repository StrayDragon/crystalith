// covers: r105（deep-research-ui）——running/awaiting_confirm 剪枝与 fork 先出轻量二次确认、确认后才经 POST 命令口生效；终态图只读无剪枝/fork 边入口且节点 Convert 入口淡化展示。
import { afterAll, beforeAll, describe, expect, it, rs } from '@rstest/core';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';

import * as streamActual from '../../api/stream' with { rstest: 'importActual' };
import { server } from '../../test-utils/msw/server';
import { TestProvidersWithSWR } from '../../test-utils/providers';

// Mock reason: 挂起 Run SSE 事件流 —— 对话框流程测试只关心命令口 POST，不消费真实 SSE。
rs.mock('../../api/stream', () => ({
  ...streamActual,
  streamRequest: rs.fn(async function* () {
    await new Promise(() => undefined);
    yield undefined as never;
  }),
}));

import ResearchLabPage from './ResearchLabPage';

const NID = 7105; // 文件内唯一 notebookId，避免全局 SWR 缓存串扰
const RID = 9105;

let pruneCalls = 0;
let forkCalls = 0;
let forkBodies: unknown[] = [];

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

describe('LabMutationDialogs light confirm + command ports (r105)', () => {
  it('running: prune asks a light confirm first, POST fires only after confirm', async () => {
    pruneCalls = 0;
    mountPage(mkRun());
    server.use(
      http.post(`*/v2/notebooks/${NID}/research/${RID}/nodes/node_research_a/prune`, () => {
        pruneCalls += 1;
        const next = mkRun();
        const nodes = next.nodes as { id: string; conclusionStatus: string }[];
        nodes.find((n) => n.id === 'node_research_a')!.conclusionStatus = 'pruned';
        return HttpResponse.json(next);
      }),
    );
    await screen.findByText('支路A');

    fireEvent.click(screen.getByRole('button', { name: '剪枝' }));

    // 轻量二次确认：预览对话框出现并展示将淡化的目标。
    const dialog = screen.getByTestId('research-lab-prune-dialog');
    expect(within(dialog).getByRole('heading', { name: '确认剪枝' })).toBeTruthy();
    expect(within(dialog).getByText('支路A')).toBeTruthy();
    // 确认前命令口未被触发。
    expect(pruneCalls).toBe(0);

    fireEvent.click(screen.getByTestId('research-lab-prune-confirm'));

    // 确认后经对应命令口生效（恰好一次）。
    await waitFor(() => {
      expect(pruneCalls).toBe(1);
    });
    await waitFor(() => {
      expect(screen.queryByTestId('research-lab-prune-dialog')).toBeNull();
    });
  });

  it('running: fork dialog confirms draft then POSTs …/nodes/:id/fork with hint', async () => {
    forkCalls = 0;
    forkBodies = [];
    mountPage(mkRun());
    server.use(
      http.post(
        `*/v2/notebooks/${NID}/research/${RID}/nodes/node_research_a/fork`,
        async ({ request }) => {
          forkCalls += 1;
          forkBodies.push(await request.json());
          const next = mkRun();
          (next.nodes as unknown[]).push({
            id: 'node_research_a2',
            title: '对照：支路A',
            role: 'research',
            conclusionStatus: 'pending',
            evidenceIds: [],
          });
          (next.edges as unknown[]).push({
            id: 'e_root_a2',
            source: 'node_root_1',
            target: 'node_research_a2',
            kind: 'expand',
          });
          return HttpResponse.json(next);
        },
      ),
    );
    await screen.findByText('支路A');

    fireEvent.click(screen.getByRole('button', { name: '分叉' }));

    const dialog = screen.getByTestId('research-lab-fork-dialog');
    expect(within(dialog).getByRole('heading', { name: '创建分叉研究节点' })).toBeTruthy();
    // 草稿标题预填（非空即可提交），确认前命令口未被触发。
    expect(
      (within(dialog).getByRole('textbox', { name: /标题/ }) as HTMLInputElement).value,
    ).not.toBe('');
    expect(forkCalls).toBe(0);

    fireEvent.click(within(dialog).getByRole('button', { name: '确认分叉' }));

    await waitFor(() => {
      expect(forkCalls).toBe(1);
    });
    // fork 可带可选 hint，经命令口 body 传递。
    expect(forkBodies[0]).toMatchObject({ hint: expect.stringContaining('对照') });
  });

  it('awaiting_confirm(budget) still offers the prune entry with its confirm dialog', async () => {
    mountPage(mkRun({ status: 'awaiting_confirm', confirmKind: 'budget' }));
    await screen.findByText('支路A');

    // 非终态（awaiting_confirm）图保持可交互：剪枝入口存在。
    fireEvent.click(screen.getByRole('button', { name: '剪枝' }));
    expect(screen.getByTestId('research-lab-prune-dialog')).toBeTruthy();
  });

  it('completed: no prune/fork edge entries; inspector Convert entry faded', async () => {
    mountPage(
      mkRun({
        status: 'completed',
        report: { title: '拓扑绝缘体综述报告', sections: [], citations: {} },
      }),
    );
    await screen.findByText('支路A');

    // 终态图只读：剪枝/fork 边入口消失。
    expect(screen.queryByRole('button', { name: '剪枝' })).toBeNull();
    expect(screen.queryByRole('button', { name: '分叉' })).toBeNull();

    // 打开节点 inspector（键盘等价路径：Enter 打开详情）。
    const wrapper = document.querySelector('[data-id="node_research_a"]');
    expect(wrapper).not.toBeNull();
    const card = wrapper!.querySelector('.lab-node-in') as HTMLElement;
    fireEvent.keyDown(card, { key: 'Enter' });

    const drawer = await screen.findByTestId('research-lab-node-drawer');
    fireEvent.click(within(drawer).getByRole('button', { name: '元信息 / 引用' }));

    // Convert 入口仍可达但淡化展示（容器 opacity-70）。
    const convertNote = await screen.findByTestId('research-lab-node-convert-note');
    expect(screen.getByTestId('research-lab-node-convert-source')).toBeTruthy();
    expect(convertNote.closest('section')?.className).toContain('opacity-70');
  });
});
