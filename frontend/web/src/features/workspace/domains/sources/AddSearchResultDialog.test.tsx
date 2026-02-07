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
