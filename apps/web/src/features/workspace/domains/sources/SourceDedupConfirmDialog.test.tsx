// c135 r491 — dedup confirm dialog choice set: filename hits offer replace
// (upload flow only); content hits keep the two-button layout.
import { expect, test, rs } from '@rstest/core';
import { fireEvent, render, screen } from '@testing-library/react';

import { TestProviders } from '../../../../test-utils/providers';
import SourceDedupConfirmDialog from './SourceDedupConfirmDialog';

function renderDialog(props: {
  kind?: 'content' | 'filename';
  onResolve: (choice: 'reuse' | 'create_new' | 'replace') => void;
}) {
  render(
    <TestProviders>
      <SourceDedupConfirmDialog
        request={{
          existingName: '更新文档.md',
          kind: props.kind,
          resolve: props.onResolve,
        }}
        onResolve={props.onResolve}
      />
    </TestProviders>,
  );
}

test('filename hit shows all three choices', () => {
  const onResolve = rs.fn();
  renderDialog({ kind: 'filename', onResolve });

  expect(screen.getByRole('button', { name: '仍创建新来源' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: '替换旧来源' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: '复用已有来源' })).toBeInTheDocument();

  fireEvent.click(screen.getByRole('button', { name: '替换旧来源' }));
  expect(onResolve).toHaveBeenCalledWith('replace');

  fireEvent.click(screen.getByRole('button', { name: '仍创建新来源' }));
  expect(onResolve).toHaveBeenCalledWith('create_new');

  fireEvent.click(screen.getByRole('button', { name: '复用已有来源' }));
  expect(onResolve).toHaveBeenCalledWith('reuse');
});

test('content hit (or URL flow) hides the replace option', () => {
  const onResolve = rs.fn();
  renderDialog({ kind: 'content', onResolve });

  expect(screen.queryByRole('button', { name: '替换旧来源' })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: '复用已有来源' }));
  expect(onResolve).toHaveBeenCalledWith('reuse');
});
