import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const runConvertToNote = vi.hoisted(() => vi.fn());
const runConvertToSource = vi.hoisted(() => vi.fn());
const toastInfo = vi.hoisted(() => vi.fn());
const toastSuccess = vi.hoisted(() => vi.fn());

// Mock reason: assert evidence convert calls helpers without hitting convert HTTP.
vi.mock('./edenConvertActions', () => ({
  runConvertToNote: (...args: unknown[]) => runConvertToNote(...args),
  runConvertToSource: (...args: unknown[]) => runConvertToSource(...args),
}));

vi.mock('../../shared/toast', () => ({
  toast: {
    success: toastSuccess,
    error: vi.fn(),
    info: toastInfo,
    warning: vi.fn(),
  },
}));

import type { LabCitation, LabNode } from './fake/types';
import LabNodeDrawer from './LabNodeDrawer';

const researchNode: LabNode = {
  id: 'branch_a',
  title: '支路A',
  role: 'research',
  conclusionStatus: 'pending',
  phase: 'idle',
  citationIds: ['ev-1'],
  query: 'q',
};

const citations: Record<string, LabCitation> = {
  'ev-1': {
    id: 'ev-1',
    title: '证据一',
    url: 'https://example.com/e1',
    snippet: '摘要',
    kind: 'web',
    origin: 'research',
  },
};

describe('LabNodeDrawer evidence convert (c91 / r445)', () => {
  beforeEach(() => {
    runConvertToNote.mockReset();
    runConvertToSource.mockReset();
    toastInfo.mockReset();
    toastSuccess.mockReset();
    runConvertToNote.mockResolvedValue({ ok: true, kind: 'note', outputId: 1 });
    runConvertToSource.mockResolvedValue({
      ok: true,
      kind: 'source',
      sourceId: 2,
      filename: 'x.md',
      chunkCount: 1,
    });
  });

  it('eden evidence convert note/source call helpers with kind=evidence', () => {
    render(
      <LabNodeDrawer
        node={researchNode}
        citations={citations}
        phase="explore"
        mode="eden"
        notebookId={62}
        runId={9}
        onClose={() => undefined}
      />,
    );

    fireEvent.click(screen.getByTestId('research-lab-evidence-convert-note-ev-1'));
    expect(runConvertToNote).toHaveBeenCalledWith(62, 9, {
      kind: 'evidence',
      evidenceId: 'ev-1',
    });

    fireEvent.click(screen.getByTestId('research-lab-evidence-convert-source-ev-1'));
    expect(runConvertToSource).toHaveBeenCalledWith(62, 9, {
      kind: 'evidence',
      evidenceId: 'ev-1',
    });
  });

  it('fixture evidence convert stubs toast and does not call helpers', () => {
    render(
      <LabNodeDrawer
        node={researchNode}
        citations={citations}
        phase="explore"
        mode="fixture"
        onClose={() => undefined}
      />,
    );

    fireEvent.click(screen.getByTestId('research-lab-evidence-convert-note-ev-1'));
    expect(runConvertToNote).not.toHaveBeenCalled();
    expect(toastInfo).toHaveBeenCalledWith(
      expect.stringContaining('演示：证据「证据一」转为笔记'),
      3200,
    );

    fireEvent.click(screen.getByTestId('research-lab-evidence-convert-source-ev-1'));
    expect(runConvertToSource).not.toHaveBeenCalled();
    expect(toastSuccess).toHaveBeenCalledWith(
      expect.stringContaining('演示：证据「证据一」转为来源'),
      3200,
    );
  });
});
