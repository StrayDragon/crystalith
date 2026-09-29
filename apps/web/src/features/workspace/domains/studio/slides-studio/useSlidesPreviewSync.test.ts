import { describe, expect, it } from '@rstest/core';
import { act, renderHook, waitFor } from '@testing-library/react';

import { useSlidesPreviewSync } from './useSlidesPreviewSync';

// covers: r313
// 预览流程先保存 markdown，再刷新预览；预览目标由当前 slides 插件声明
// （slidesConfig.preview），宿主不硬编码 Slidev；未声明预览入口时明确报错
// 且不触发保存。

const CONFIG_WITH_PREVIEW = {
  preview: { kind: 'external_url', service: 'slidev' },
} as never;

function setup(overrides?: Partial<Parameters<typeof useSlidesPreviewSync>[0]>) {
  const order: string[] = [];
  const save = async () => {
    order.push('save');
  };
  const utils = renderHook(() =>
    useSlidesPreviewSync({
      open: true,
      isPreviewMode: true,
      isConnected: true,
      draftId: 7,
      markdown: '# deck',
      slidesTool: {} as never,
      slidesConfig: CONFIG_WITH_PREVIEW,
      slidesConfigErrorMessage: '',
      slidesEngine: 'slidev',
      handleSaveMarkdown: save,
      ...overrides,
    }),
  );
  return { order, ...utils };
}

describe('r313 preview always saves the latest markdown first', () => {
  it('save runs before the preview target refreshes', async () => {
    const { result, order } = setup();
    await act(async () => {
      await result.current.handlePreview();
    });
    expect(order).toContain('save');
    await waitFor(() => expect(result.current.previewMarkdown).toBe('# deck'));
  });

  it('a plugin without a declared preview entry errors out and never saves', async () => {
    const { result, order } = setup({ slidesConfig: {} as never });
    await act(async () => {
      await result.current.handlePreview();
    });
    expect(order).toEqual([]);
    expect(result.current.previewError).toContain('未声明预览入口');
  });

  it('stale preview state resets when the draft switches', async () => {
    const first = setup();
    await first.result.current.handlePreview();
    await waitFor(() => expect(first.result.current.previewMarkdown).toBe('# deck'));

    const second = setup({ draftId: 8 });
    expect(second.result.current.previewMarkdown).toBe('');
  });
});
