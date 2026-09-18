// Mock reason: renders real @xyflow/react + elkjs in jsdom (no network, no rs.* mocks beyond fns).
import { afterAll, beforeAll, describe, expect, it, rs } from '@rstest/core';
import { createEvent, fireEvent, render, screen } from '@testing-library/react';

import { LayerProvider } from '../../shared/layer';
import LabGraph from './LabGraph';
import type { LabEdge, LabNode } from './model/types';

// Lock test for deep-research-ui r106: keyboard users can open the node inspector
// from a focused node, and edge fork/prune actions are tab-reachable (not hover-only).

// jsdom reports zero element dimensions; xyflow renders edges only once nodes are
// measured. Emulate non-zero cards + the initial ResizeObserver tick real browsers fire.
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
  // xyflow reads `m22` from a DOMMatrixReadOnly of the viewport transform; jsdom has none.
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

      // xyflow constructs with the viewport transform string; keep the signature.
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
});

const onSelectNode = rs.fn();
const onForkEdge = rs.fn();
const onPruneEdge = rs.fn();

function node(over: Partial<LabNode> & Pick<LabNode, 'id' | 'title'>): LabNode {
  return { role: 'research', conclusionStatus: 'pending', citationIds: [], ...over };
}

const nodes: LabNode[] = [
  node({ id: 'node_root', title: '主问题', role: 'question' }),
  node({ id: 'n1', title: '支路A' }),
  node({ id: 'n2', title: '支路B', conclusionStatus: 'pruned' }),
  node({ id: 'node_conclusion', title: '结论', role: 'conclusion', conclusionStatus: 'pending' }),
];

const edges: LabEdge[] = [
  { id: 'e_root_n1', source: 'node_root', target: 'n1', kind: 'expand' },
  { id: 'e_n1_c', source: 'n1', target: 'node_conclusion', kind: 'merge' },
  { id: 'e_n2_c', source: 'n2', target: 'node_conclusion', kind: 'merge' },
];

function renderGraph(opts?: { readOnly?: boolean }) {
  return render(
    <LayerProvider>
      <LabGraph
        nodes={nodes}
        edges={edges}
        selectedNodeId={null}
        onSelectNode={onSelectNode}
        onForkEdge={onForkEdge}
        onPruneEdge={onPruneEdge}
        onDirection={() => {}}
        onAlgorithm={() => {}}
        onEdgePathPreset={() => {}}
        readOnly={opts?.readOnly}
      />
    </LayerProvider>,
  );
}

/** xyflow wraps each node in [data-id]; our focusable card is the .lab-node-in inside. */
function nodeCard(id: string): HTMLElement {
  const wrapper = document.querySelector(`[data-id="${id}"]`);
  expect(wrapper).not.toBeNull();
  const card = wrapper!.querySelector('.lab-node-in');
  expect(card).not.toBeNull();
  return card as HTMLElement;
}

describe('LabGraph keyboard access (r15)', () => {
  it('Enter on a focused node opens the inspector', async () => {
    renderGraph();
    await screen.findByText('支路A');
    const card = nodeCard('n1');
    card.focus();
    fireEvent.keyDown(card, { key: 'Enter' });
    expect(onSelectNode).toHaveBeenCalledWith('n1');
  });

  it('Space on a focused node opens the inspector without scrolling', async () => {
    renderGraph();
    await screen.findByText('支路A');
    const card = nodeCard('n1');
    card.focus();
    const event = createEvent.keyDown(card, { key: ' ' });
    fireEvent(card, event);
    expect(onSelectNode).toHaveBeenCalledWith('n1');
    expect(event.defaultPrevented).toBe(true);
  });

  it('edge fork/prune buttons are reachable without hover and fire edge actions', async () => {
    renderGraph();
    await screen.findByText('支路A');
    const fork = screen.getByRole('button', { name: '分叉' });
    // Keyboard reachability: focusable and in the a11y tree without any hover.
    // (Visual reveal is CSS group-focus-within — jsdom cannot compute Tailwind
    // styles, so visibility-on-focus is asserted in browser e2e, not here.)
    fork.focus();
    expect(document.activeElement).toBe(fork);
    fireEvent.click(fork);
    expect(onForkEdge).toHaveBeenCalledWith('e_root_n1');
    fireEvent.click(screen.getByRole('button', { name: '剪枝' }));
    expect(onPruneEdge).toHaveBeenCalledWith('e_root_n1');
  });

  it('pruned branches expose no fork/prune buttons and their nodes still open read-only', async () => {
    renderGraph();
    await screen.findByText('支路B');
    // Only e_root_n1 targets a live research node; the pruned branch has no actions.
    expect(screen.getAllByRole('button', { name: '分叉' })).toHaveLength(1);
    expect(screen.getAllByRole('button', { name: '剪枝' })).toHaveLength(1);
    const card = nodeCard('n2');
    card.focus();
    fireEvent.keyDown(card, { key: 'Enter' });
    expect(onSelectNode).toHaveBeenCalledWith('n2');
  });

  it('readOnly (terminal run, r406/r15) drops edge actions but nodes still open', async () => {
    renderGraph({ readOnly: true });
    await screen.findByText('支路A');
    expect(screen.queryByRole('button', { name: '分叉' })).toBeNull();
    expect(screen.queryByRole('button', { name: '剪枝' })).toBeNull();
    const card = nodeCard('n1');
    card.focus();
    fireEvent.keyDown(card, { key: 'Enter' });
    expect(onSelectNode).toHaveBeenCalledWith('n1');
  });
});
