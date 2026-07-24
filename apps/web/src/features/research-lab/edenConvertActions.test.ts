import { beforeEach, describe, expect, it, vi } from 'vitest';

const convertResearchToNote = vi.hoisted(() => vi.fn());
const convertResearchToSource = vi.hoisted(() => vi.fn());
const toastSuccess = vi.hoisted(() => vi.fn());
const toastError = vi.hoisted(() => vi.fn());

// Mock reason: stub convert Eden calls + toast to assert r409 feedback without HTTP.
vi.mock('./edenResearchApi', () => ({
  convertResearchToNote,
  convertResearchToSource,
}));

vi.mock('../../shared/toast', () => ({
  toast: {
    success: toastSuccess,
    error: toastError,
    info: vi.fn(),
    warning: vi.fn(),
  },
}));

import { runConvertToNote, runConvertToSource } from './edenConvertActions';

describe('edenConvertActions', () => {
  beforeEach(() => {
    convertResearchToNote.mockReset();
    convertResearchToSource.mockReset();
    toastSuccess.mockReset();
    toastError.mockReset();
  });

  it('convertToNote success toasts without confirm dialog', async () => {
    convertResearchToNote.mockResolvedValue({ outputId: 42, type: 'PARAGRAPH' });
    const res = await runConvertToNote(1, 9, { kind: 'report' });
    expect(convertResearchToNote).toHaveBeenCalledWith(1, 9, { kind: 'report' });
    expect(res).toEqual({ ok: true, kind: 'note', outputId: 42 });
    expect(toastSuccess).toHaveBeenCalled();
    expect(toastError).not.toHaveBeenCalled();
  });

  it('convertToSource sends kind=node artifact and toasts', async () => {
    convertResearchToSource.mockResolvedValue({
      sourceId: 7,
      filename: 'research-9-node.md',
      chunkCount: 2,
    });
    const res = await runConvertToSource(1, 9, { kind: 'node', nodeId: 'n1' });
    expect(convertResearchToSource).toHaveBeenCalledWith(1, 9, {
      kind: 'node',
      nodeId: 'n1',
    });
    expect(res.ok).toBe(true);
    expect(toastSuccess).toHaveBeenCalled();
  });

  it('convert failure toasts error', async () => {
    convertResearchToNote.mockRejectedValue(new Error('boom'));
    const res = await runConvertToNote(1, 9, { kind: 'report' });
    expect(res).toEqual({ ok: false, error: 'boom' });
    expect(toastError).toHaveBeenCalled();
  });
});
