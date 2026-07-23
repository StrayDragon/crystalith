import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { LayerProvider } from '../../../../shared/layer';
import { TestIds } from '../../../../shared/testids';

// Mock reason: isolate Escape/primary-surface UI from Eden/SSE detail hook.
vi.mock('./useResearchRunDetail', () => ({
  useResearchRunDetail: () => ({
    run: {
      id: 1,
      notebookId: 1,
      topic: '测试主题',
      status: 'running',
      useNotebookSources: false,
      allowWeb: true,
      depth: 'medium',
      maxSearches: 20,
      maxNodes: 30,
      searchesUsed: 2,
      nodes: [{ id: 'n1', title: '节点1', conclusionStatus: 'pending' }],
      edges: [],
      report: {
        title: '草稿',
        sections: [],
        citations: {},
      },
      createdAt: '2026-07-21T00:00:00.000Z',
      updatedAt: '2026-07-21T00:00:00.000Z',
    },
    isLoading: false,
    error: '',
    busy: false,
    setError: vi.fn(),
    fetchRun: vi.fn(),
    confirm: vi.fn(),
    cancel: vi.fn(),
    prune: vi.fn(),
    fork: vi.fn(),
    patchNode: vi.fn(),
    chatNode: vi.fn(),
    listProgress: vi.fn(async () => ({ items: [] })),
    listRevisions: vi.fn(async () => ({ items: [] })),
    createRevision: vi.fn(),
    restoreRevision: vi.fn(),
    getReportView: vi.fn(async () => null),
    putWorkingReport: vi.fn(),
    discardWorkingReport: vi.fn(),
    convertToNote: vi.fn(),
    convertToSource: vi.fn(),
  }),
}));

// Mock reason: avoid mounting @xyflow/react in jsdom for surface/Escape tests.
vi.mock('./ResearchGraph', () => ({
  default: () => <div data-testid="research-graph-mock" />,
}));

import DeepResearchRunDetail, { resolvePrimarySurface } from './DeepResearchRunDetail';

afterEach(() => {
  cleanup();
});

describe('DeepResearchRunDetail Escape hierarchy', () => {
  it('Escape closes detail via capture without requiring E1 close', () => {
    const onClose = vi.fn();
    render(
      <LayerProvider>
        <DeepResearchRunDetail open notebookId={1} runId={1} onClose={onClose} />
      </LayerProvider>,
    );
    expect(screen.getByTestId(TestIds.researchRunDetail)).toBeTruthy();
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(onClose).toHaveBeenCalled();
  });

  it('process status keeps graph as primary (draft collapsed bar present)', () => {
    expect(resolvePrimarySurface('running')).toBe('graph');
    render(
      <LayerProvider>
        <DeepResearchRunDetail open notebookId={1} runId={1} onClose={vi.fn()} />
      </LayerProvider>,
    );
    expect(screen.getByTestId('research-graph-mock')).toBeTruthy();
    expect(screen.getByText(/展开报告草稿|折叠报告草稿/)).toBeTruthy();
  });
});
