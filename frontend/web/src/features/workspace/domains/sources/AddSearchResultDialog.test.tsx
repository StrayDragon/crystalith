import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { expect, test, vi } from 'vitest';

import AddSearchResultDialog from './AddSearchResultDialog';
import { LayerProvider } from '../../../../shared/layer';

const sampleResult = {
  title: 'Example Title',
  url: 'https://example.com/article',
  snippet: 'Example snippet',
};

test('dialog supports retrying failed source import', async () => {
  const onAddSource = vi
    .fn()
    .mockRejectedValueOnce(new Error('抓取失败'))
    .mockResolvedValueOnce(undefined);

  render(
    <LayerProvider>
      <AddSearchResultDialog
        open
        onClose={vi.fn()}
        results={[sampleResult]}
        mode="fetch"
        onAddSource={onAddSource}
        onComplete={vi.fn()}
      />
    </LayerProvider>,
  );

  await waitFor(() => {
    expect(onAddSource).toHaveBeenCalledTimes(1);
  });

  await waitFor(() => {
    expect(screen.getByRole('button', { name: '重试' })).toBeInTheDocument();
  });

  fireEvent.click(screen.getByRole('button', { name: '重试' }));

  await waitFor(() => {
    expect(onAddSource).toHaveBeenCalledTimes(2);
  });
});

test('dialog shows progress text while batch adding sources', async () => {
  let releaseFirst: ((value?: void) => void) | undefined;
  const onAddSource = vi
    .fn()
    .mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          releaseFirst = resolve;
        }),
    )
    .mockResolvedValue(undefined);

  render(
    <LayerProvider>
      <AddSearchResultDialog
        open
        onClose={vi.fn()}
        results={[
          sampleResult,
          { ...sampleResult, url: 'https://example.com/article-2', title: 'Title 2' },
          { ...sampleResult, url: 'https://example.com/article-3', title: 'Title 3' },
        ]}
        mode="fetch"
        onAddSource={onAddSource}
        onComplete={vi.fn()}
      />
    </LayerProvider>,
  );

  await waitFor(() => {
    expect(onAddSource).toHaveBeenCalledTimes(1);
  });

  expect(screen.getAllByText('正在添加 1/3 个来源').length).toBeGreaterThan(0);

  releaseFirst?.();

  await waitFor(() => {
    expect(screen.getByText('3 / 3 完成')).toBeInTheDocument();
  });
});
