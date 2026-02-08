import { act, waitFor } from '@testing-library/react';
import { beforeEach, expect, test, vi } from 'vitest';

import type { OutputItem } from '../../shared/types';
import { renderHook } from '../../../../test-utils/renderHook';
import { toast } from '../../../../shared/toast';
import { useExport } from './useExport';

const toastMock = vi.mocked(toast);

const writeFileMock = vi.fn(async () => undefined);

vi.mock('jspdf', () => ({
  jsPDF: class JsPdfMock {
    internal = { pageSize: { height: 800 } };

    splitTextToSize(text: string) {
      return text.split('\n');
    }

    text() {}

    addPage() {}

    output() {
      return new Blob(['%PDF-1.4 mock']);
    }
  },
}));

vi.mock('pptxgenjs', () => ({
  default: class PptxGenMock {
    layout?: string;
    author?: string;
    subject?: string;
    title?: string;

    addSlide() {
      return {
        addText: vi.fn(),
      };
    }

    writeFile(options: { fileName: string }) {
      return writeFileMock(options);
    }
  },
}));

vi.mock('../../../../shared/toast', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    warning: vi.fn(),
  },
}));

function createOutput(type: OutputItem['type'], content: Record<string, unknown>): OutputItem {
  return {
    id: 1,
    type,
    prompt: `${type} prompt`,
    chunkIds: [1],
    content,
    createdAt: '2026-01-01 10:00',
    updatedAt: '2026-01-01 10:00',
  };
}

beforeEach(() => {
  toastMock.success.mockClear();
  toastMock.error.mockClear();
  toastMock.info.mockClear();
  toastMock.warning.mockClear();
  writeFileMock.mockClear();

  Object.defineProperty(URL, 'createObjectURL', {
    configurable: true,
    value: vi.fn(() => 'blob:mock'),
  });
  Object.defineProperty(URL, 'revokeObjectURL', {
    configurable: true,
    value: vi.fn(),
  });
});

test('exports markdown via download and resets state', async () => {
  const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
  const { result } = renderHook(() => useExport());

  await act(async () => {
    await result.current.exportOutput(
      createOutput('GUIDE', { modules: [{ title: '模块一', objective: { text: '理解基础' } }] }),
      'markdown',
    );
  });

  await waitFor(() => {
    expect(result.current.isExporting).toBe(false);
    expect(result.current.activeFormat).toBe(null);
  });

  expect(toastMock.success).toHaveBeenCalled();
  expect(clickSpy).toHaveBeenCalled();
  clickSpy.mockRestore();
});

test('exports pdf and pptx via special exporters', async () => {
  const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
  const { result } = renderHook(() => useExport());

  await act(async () => {
    await result.current.exportOutput(
      createOutput('BRIEFING', { sections: [{ heading: '重点', points: [{ text: '性能提升' }] }] }),
      'pdf',
    );
  });

  expect(toastMock.success).toHaveBeenCalled();
  expect(clickSpy).toHaveBeenCalled();

  await act(async () => {
    await result.current.exportOutput(
      createOutput('SLIDES', {
        outline: { slides: [{ title: '第一页', bullets: ['A', 'B'] }] },
      }),
      'pptx',
    );
  });

  expect(writeFileMock).toHaveBeenCalledTimes(1);
  expect(writeFileMock.mock.calls[0][0].fileName).toMatch(/\.pptx$/i);
  clickSpy.mockRestore();
});
