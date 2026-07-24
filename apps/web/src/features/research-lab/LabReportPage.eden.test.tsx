import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import type { ReactElement } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { LayerProvider } from '../../shared/layer';

const getResearchRun = vi.hoisted(() => vi.fn());
const getResearchReportView = vi.hoisted(() => vi.fn());
const listResearchRevisions = vi.hoisted(() => vi.fn());
const createResearchRevision = vi.hoisted(() => vi.fn());
const restoreResearchRevision = vi.hoisted(() => vi.fn());
const putResearchWorkingReport = vi.hoisted(() => vi.fn());
const putResearchCanonicalReport = vi.hoisted(() => vi.fn());
const discardResearchWorkingReport = vi.hoisted(() => vi.fn());
const convertResearchToNote = vi.hoisted(() => vi.fn());
const convertResearchToSource = vi.hoisted(() => vi.fn());

// Mock reason: stub ResearchRun report/revisions/convert APIs for Eden LabReportPage unit tests.
vi.mock('./edenResearchApi', () => ({
  getResearchRun,
  getResearchReportView,
  listResearchRevisions,
  createResearchRevision,
  restoreResearchRevision,
  putResearchWorkingReport,
  putResearchCanonicalReport,
  discardResearchWorkingReport,
  convertResearchToNote,
  convertResearchToSource,
}));

vi.mock('../../shared/toast', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    warning: vi.fn(),
  },
}));

import { toast } from '../../shared/toast';
import LabReportPage from './LabReportPage';

function renderWithLayer(ui: ReactElement) {
  return render(<LayerProvider>{ui}</LayerProvider>);
}

const sampleReport = {
  title: '研究报告：主题',
  sections: [
    {
      id: 'overview',
      heading: '概述',
      blocks: [{ type: 'paragraph' as const, text: '围绕主题的结论。', citeIds: ['c1'] }],
    },
  ],
  citations: {
    c1: { sourceName: '来源A', snippet: '证据片段' },
  },
};

function stubReady(opts?: { working?: typeof sampleReport | null }) {
  getResearchRun.mockResolvedValue({
    id: 9,
    notebookId: 62,
    status: 'completed',
    topic: '主题',
    nodes: [],
    edges: [],
    report: sampleReport,
  });
  getResearchReportView.mockResolvedValue({
    canonical: sampleReport,
    working: opts?.working ?? undefined,
    viewing: opts?.working ? 'working' : 'canonical',
  });
  listResearchRevisions.mockResolvedValue({
    items: [
      {
        id: 'rev_1',
        runId: 9,
        notebookId: 62,
        label: '自动完成',
        kind: 'auto_complete',
        graph: { nodes: [], edges: [] },
        report: sampleReport,
        searchesUsed: 0,
        statusAtSave: 'completed',
        createdAt: '2026-01-01T00:00:00.000Z',
      },
    ],
  });
}

describe('LabReportPage eden revisions/convert (c89)', () => {
  beforeEach(() => {
    getResearchRun.mockReset();
    getResearchReportView.mockReset();
    listResearchRevisions.mockReset();
    createResearchRevision.mockReset();
    restoreResearchRevision.mockReset();
    putResearchWorkingReport.mockReset();
    putResearchCanonicalReport.mockReset();
    discardResearchWorkingReport.mockReset();
    convertResearchToNote.mockReset();
    convertResearchToSource.mockReset();
    vi.mocked(toast.success).mockReset();
    vi.mocked(toast.error).mockReset();
    vi.mocked(toast.info).mockReset();
  });

  it('loads revisions from GET revisions not sessionStorage', async () => {
    stubReady();
    const getItem = vi.spyOn(Storage.prototype, 'getItem');

    renderWithLayer(<LabReportPage notebookId={62} mode="eden" runId={9} />);

    await waitFor(() => {
      expect(screen.getByText('研究报告：主题')).toBeTruthy();
    });
    expect(listResearchRevisions).toHaveBeenCalledWith(62, 9);
    expect(getResearchReportView).toHaveBeenCalledWith(62, 9);
    const select = screen.getByTestId('research-lab-revision-select');
    expect(within(select).getByText(/自动完成/)).toBeTruthy();
    expect(
      getItem.mock.calls.some(([k]) => String(k).includes('crystalith.research-lab.revisions')),
    ).toBe(false);
    getItem.mockRestore();
  });

  it('create revision calls POST revisions', async () => {
    stubReady();
    createResearchRevision.mockResolvedValue({
      id: 'rev_2',
      runId: 9,
      notebookId: 62,
      label: '保存 1',
      kind: 'user_save',
      graph: { nodes: [], edges: [] },
      report: sampleReport,
      searchesUsed: 0,
      statusAtSave: 'completed',
      createdAt: '2026-01-02T00:00:00.000Z',
    });
    listResearchRevisions
      .mockResolvedValueOnce({
        items: [
          {
            id: 'rev_1',
            runId: 9,
            notebookId: 62,
            label: '自动完成',
            kind: 'auto_complete',
            graph: { nodes: [], edges: [] },
            report: sampleReport,
            searchesUsed: 0,
            statusAtSave: 'completed',
            createdAt: '2026-01-01T00:00:00.000Z',
          },
        ],
      })
      .mockResolvedValueOnce({
        items: [
          {
            id: 'rev_2',
            runId: 9,
            notebookId: 62,
            label: '保存 1',
            kind: 'user_save',
            graph: { nodes: [], edges: [] },
            report: sampleReport,
            searchesUsed: 0,
            statusAtSave: 'completed',
            createdAt: '2026-01-02T00:00:00.000Z',
          },
        ],
      });

    renderWithLayer(<LabReportPage notebookId={62} mode="eden" runId={9} />);
    await waitFor(() => expect(screen.getByText('研究报告：主题')).toBeTruthy());

    fireEvent.click(screen.getByTestId('research-lab-revision-save'));
    await waitFor(() => {
      expect(createResearchRevision).toHaveBeenCalledWith(62, 9, { from: 'canonical' });
    });
  });

  it('convert report to note toasts on success', async () => {
    stubReady();
    convertResearchToNote.mockResolvedValue({ outputId: 99, type: 'PARAGRAPH' });
    renderWithLayer(<LabReportPage notebookId={62} mode="eden" runId={9} />);
    await waitFor(() => expect(screen.getByText('研究报告：主题')).toBeTruthy());

    fireEvent.click(screen.getByRole('button', { name: /转为笔记/ }));
    await waitFor(() => {
      expect(convertResearchToNote).toHaveBeenCalledWith(62, 9, { kind: 'report' });
      expect(toast.success).toHaveBeenCalled();
    });
  });

  it('discard working calls DELETE report/working', async () => {
    stubReady({ working: { ...sampleReport, title: '草稿' } });
    discardResearchWorkingReport.mockResolvedValue({
      canonical: sampleReport,
      working: undefined,
      viewing: 'canonical',
    });
    vi.spyOn(window, 'confirm').mockReturnValue(true);

    renderWithLayer(<LabReportPage notebookId={62} mode="eden" runId={9} />);
    await waitFor(() => expect(screen.getByText('草稿')).toBeTruthy());

    fireEvent.click(screen.getByTestId('research-lab-report-discard'));
    await waitFor(() => {
      expect(discardResearchWorkingReport).toHaveBeenCalledWith(62, 9);
    });
  });

  it('shows visible empty state when run has no report', async () => {
    getResearchRun.mockResolvedValue({
      id: 9,
      notebookId: 62,
      status: 'completed',
      topic: '主题',
      nodes: [],
      edges: [],
      report: null,
    });
    getResearchReportView.mockResolvedValue({
      canonical: null,
      viewing: 'canonical',
    });
    listResearchRevisions.mockResolvedValue({ items: [] });

    renderWithLayer(<LabReportPage notebookId={62} mode="eden" runId={9} />);

    await waitFor(() => {
      expect(screen.getByText(/尚无报告/)).toBeTruthy();
    });
  });

  it('shows error when rid missing', async () => {
    renderWithLayer(<LabReportPage notebookId={62} mode="eden" runId={null} />);

    await waitFor(() => {
      expect(screen.getByText(/缺少 \?rid=/)).toBeTruthy();
    });
    expect(getResearchRun).not.toHaveBeenCalled();
  });
});
