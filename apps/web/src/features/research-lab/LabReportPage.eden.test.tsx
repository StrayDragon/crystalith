import { render, screen, waitFor } from '@testing-library/react';
import type { ReactElement } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { LayerProvider } from '../../shared/layer';

const getResearchRun = vi.hoisted(() => vi.fn());

// Mock reason: stub GET research run so Eden report loader unit-tests without HTTP.
vi.mock('./edenResearchApi', () => ({
  getResearchRun,
}));

import LabReportPage from './LabReportPage';

function renderWithLayer(ui: ReactElement) {
  return render(<LayerProvider>{ui}</LayerProvider>);
}

describe('LabReportPage eden loader', () => {
  beforeEach(() => {
    getResearchRun.mockReset();
  });

  it('loads Run report title and section via getResearchRun', async () => {
    getResearchRun.mockResolvedValue({
      id: 9,
      notebookId: 62,
      status: 'completed',
      topic: '主题',
      nodes: [],
      edges: [],
      report: {
        title: '研究报告：主题',
        sections: [
          {
            id: 'overview',
            heading: '概述',
            blocks: [{ type: 'paragraph', text: '围绕主题的结论。', citeIds: ['c1'] }],
          },
        ],
        citations: {
          c1: { sourceName: '来源A', snippet: '证据片段' },
        },
      },
    });

    renderWithLayer(<LabReportPage notebookId={62} mode="eden" runId={9} />);

    await waitFor(() => {
      expect(screen.getByText('研究报告：主题')).toBeTruthy();
    });
    expect(screen.getByText('概述')).toBeTruthy();
    expect(screen.getByText(/围绕主题的结论/)).toBeTruthy();
    expect(getResearchRun).toHaveBeenCalledWith(62, 9);
    expect(screen.getByLabelText(/查看报告引用/)).toBeTruthy();
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
