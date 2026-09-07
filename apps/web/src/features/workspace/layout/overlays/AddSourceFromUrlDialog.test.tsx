import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { expect, test, vi } from 'vitest';

import { TestIds } from '../../../../shared/testids';
import { TestProviders } from '../../../../test-utils/providers';
import AddSourceFromUrlDialog from './AddSourceFromUrlDialog';

const arxivExtractor = {
  type: 'arxiv',
  enabled: true,
  available: true,
  displayName: 'arXiv',
  description: 'arXiv extractor',
  priority: 10,
  requiresApiKey: false,
  requiresService: false,
  urlPatterns: ['^https?:\\/\\/(?:www\\.|export\\.)?arxiv\\.org\\/abs\\/'],
};

test('fetch mode shows arxiv hint and passes selected extractor on submit', async () => {
  const onAdd = vi.fn().mockResolvedValue(undefined);

  render(
    <TestProviders>
      <AddSourceFromUrlDialog
        open
        defaultMode="fetch"
        onClose={vi.fn()}
        onAdd={onAdd}
        extractors={[arxivExtractor]}
      />
    </TestProviders>,
  );

  fireEvent.change(screen.getByTestId(TestIds.urlImportInput), {
    target: { value: 'https://arxiv.org/abs/1706.03762' },
  });

  expect(screen.getByTestId(TestIds.urlImportExtractorHints)).toBeInTheDocument();
  expect(screen.getByTestId(TestIds.urlImportExtractorChip('arxiv'))).toBeInTheDocument();

  fireEvent.click(screen.getByTestId(TestIds.urlImportSubmit));

  await waitFor(() => {
    expect(onAdd).toHaveBeenCalledWith('https://arxiv.org/abs/1706.03762', 'fetch', {
      extractor: 'arxiv',
    });
  });
});

test('unchecking matched extractor submits without explicit extractor', async () => {
  const onAdd = vi.fn().mockResolvedValue(undefined);

  render(
    <TestProviders>
      <AddSourceFromUrlDialog
        open
        defaultMode="fetch"
        onClose={vi.fn()}
        onAdd={onAdd}
        extractors={[arxivExtractor]}
      />
    </TestProviders>,
  );

  fireEvent.change(screen.getByTestId(TestIds.urlImportInput), {
    target: { value: 'https://arxiv.org/abs/1706.03762' },
  });

  fireEvent.click(screen.getByTestId(TestIds.urlImportExtractorChip('arxiv')));
  fireEvent.click(screen.getByTestId(TestIds.urlImportSubmit));

  await waitFor(() => {
    expect(onAdd).toHaveBeenCalledWith('https://arxiv.org/abs/1706.03762', 'fetch', undefined);
  });
});

test('link mode does not show extractor hints', () => {
  render(
    <TestProviders>
      <AddSourceFromUrlDialog
        open
        defaultMode="link"
        onClose={vi.fn()}
        onAdd={vi.fn()}
        extractors={[arxivExtractor]}
      />
    </TestProviders>,
  );

  fireEvent.change(screen.getByTestId(TestIds.urlImportInput), {
    target: { value: 'https://arxiv.org/abs/1706.03762' },
  });

  expect(screen.queryByTestId(TestIds.urlImportExtractorHints)).not.toBeInTheDocument();
});
