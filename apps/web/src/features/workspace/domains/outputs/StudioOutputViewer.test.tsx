import { expect, test, rs } from '@rstest/core';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';

import { TestIds } from '../../../../shared/testids';
import { TestProviders } from '../../../../test-utils/providers';
import type { OutputItem } from '../../shared/types';
import StudioOutputViewer from './StudioOutputViewer';

function createOutput(): OutputItem {
  return {
    id: 1,
    type: 'FAQ',
    prompt: 'faq prompt',
    chunkIds: [1],
    content: null,
    contentLoaded: false,
    createdAt: '2026-01-01 10:00',
    updatedAt: '2026-01-01 10:00',
  };
}

function renderViewer(overrides: { onDeleteOutput?: (outputId: number) => void } = {}) {
  return render(
    <TestProviders>
      <StudioOutputViewer
        outputs={[createOutput()]}
        selectedOutputId={1}
        isOpen
        isFullscreen={false}
        onClose={rs.fn()}
        onToggleFullscreen={rs.fn()}
        onSelectOutput={rs.fn()}
        onDeleteOutput={overrides.onDeleteOutput}
      />
    </TestProviders>,
  );
}

// covers: r492 — 预览侧栏卡片菜单内的删除确认气泡须渲染（菜单保持开启，ConfirmPopover 不随菜单卸载）
test('sidebar card menu delete opens confirm popover and confirms removal', async () => {
  const onDeleteOutput = rs.fn();
  renderViewer({ onDeleteOutput });

  fireEvent.click(screen.getByTestId(TestIds.outputViewerItemMenu));
  fireEvent.click(await screen.findByText('删除'));
  fireEvent.click(await screen.findByTestId(TestIds.confirmPopoverConfirm));

  await waitFor(() => {
    expect(onDeleteOutput).toHaveBeenCalledWith(1);
  });
});
