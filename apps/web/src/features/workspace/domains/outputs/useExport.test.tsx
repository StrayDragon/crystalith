import { beforeEach, expect, test, rs } from '@rstest/core';
import { act, waitFor } from '@testing-library/react';

import { toast } from '../../../../shared/toast';
import { renderHook } from '../../../../test-utils/renderHook';
import type { OutputItem } from '../../shared/types';
import { useExport } from './useExport';

const writeFileMock = rs.fn(async (_options: { fileName: string }) => undefined);
let toastSuccessSpy: ReturnType<typeof rs.spyOn>;
let toastErrorSpy: ReturnType<typeof rs.spyOn>;
let toastInfoSpy: ReturnType<typeof rs.spyOn>;
let toastWarningSpy: ReturnType<typeof rs.spyOn>;

// Mock reason: export libs rely on browser/document internals not available in jsdom.
rs.mock('jspdf', () => ({
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

// Mock reason: export libs rely on browser/document internals not available in jsdom.
rs.mock('pptxgenjs', () => ({
  default: class PptxGenMock {
    layout?: string;
    author?: string;
    subject?: string;
    title?: string;

    addSlide() {
      return {
        addText: rs.fn(),
      };
    }

    writeFile(options: { fileName: string }) {
      return writeFileMock(options);
    }
  },
}));

function createOutput(type: OutputItem['type'], content: Record<string, unknown>): OutputItem {
  return {
    id: 1,
    type,
    prompt: `${type} prompt`,
    chunkIds: [1],
    content,
    contentLoaded: true,
    createdAt: '2026-01-01 10:00',
    updatedAt: '2026-01-01 10:00',
  };
}

beforeEach(() => {
  // Mock reason: suppress visual toast side effects while asserting notification calls.
  toastSuccessSpy = rs.spyOn(toast, 'success').mockImplementation(() => {});
  toastErrorSpy = rs.spyOn(toast, 'error').mockImplementation(() => {});
  toastInfoSpy = rs.spyOn(toast, 'info').mockImplementation(() => {});
  toastWarningSpy = rs.spyOn(toast, 'warning').mockImplementation(() => {});

  toastSuccessSpy.mockClear();
  toastErrorSpy.mockClear();
  toastInfoSpy.mockClear();
  toastWarningSpy.mockClear();
  writeFileMock.mockClear();

  Object.defineProperty(URL, 'createObjectURL', {
    configurable: true,
    value: rs.fn(() => 'blob:mock'),
  });
  Object.defineProperty(URL, 'revokeObjectURL', {
    configurable: true,
    value: rs.fn(),
  });
});

test('exports markdown via download and resets state', async () => {
  // Mock reason: jsdom has no real browser navigation/download pipeline; assert anchor click contract only.
  const clickSpy = rs.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
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

  expect(toastSuccessSpy).toHaveBeenCalled();
  expect(clickSpy).toHaveBeenCalled();
  clickSpy.mockRestore();
});

test('exports pdf and pptx via special exporters', async () => {
  // Mock reason: jsdom has no real browser navigation/download pipeline; assert anchor click contract only.
  const clickSpy = rs.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
  const { result } = renderHook(() => useExport());

  await act(async () => {
    await result.current.exportOutput(
      createOutput('BRIEFING', { sections: [{ heading: '重点', points: [{ text: '性能提升' }] }] }),
      'pdf',
    );
  });

  expect(toastSuccessSpy).toHaveBeenCalled();
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
  const options = writeFileMock.mock.calls[0]?.[0];
  expect(options).toBeTruthy();
  expect(options!.fileName).toMatch(/\.pptx$/i);
  clickSpy.mockRestore();
});
