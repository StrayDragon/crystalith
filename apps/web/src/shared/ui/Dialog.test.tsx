// covers: r340（web-ui-foundation）——Dialog 共用 overlay 策略：portal 到 body、Esc 与遮罩点击回调 handler(false)、Tab 焦点圈闭。
import { expect, test, rs } from '@rstest/core';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';

import { TestProviders } from '../../test-utils/providers';
import { Dialog, DialogBody, DialogFooter, DialogHeader } from './Dialog';

function renderDialog(open = true) {
  const handler = rs.fn();
  const utils = render(
    <TestProviders>
      <Dialog open={open} handler={handler} aria-label="示例对话框">
        <DialogHeader>对话框标题</DialogHeader>
        <DialogBody>
          <button type="button">第一个按钮</button>
          <button type="button">最后一个按钮</button>
        </DialogBody>
        <DialogFooter>页脚</DialogFooter>
      </Dialog>
    </TestProviders>,
  );
  return { handler, ...utils };
}

test('open dialog portals its panel to document.body, not the render container', () => {
  const { container } = renderDialog();
  const dialog = screen.getByRole('dialog', { name: '示例对话框' });

  expect(document.body.contains(dialog)).toBe(true);
  expect(container.contains(dialog)).toBe(false);
});

test('closed dialog renders nothing', () => {
  const { container } = renderDialog(false);

  expect(container.firstChild).toBeNull();
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
});

test('Escape inside the dialog calls handler(false)', () => {
  const { handler } = renderDialog();

  fireEvent.keyDown(screen.getByRole('dialog', { name: '示例对话框' }), { key: 'Escape' });

  expect(handler).toHaveBeenCalledWith(false);
});

test('clicking the overlay backdrop calls handler(false)', () => {
  const { handler } = renderDialog();

  fireEvent.click(screen.getByRole('button', { name: '关闭对话框' }));

  expect(handler).toHaveBeenCalledWith(false);
});

test('Tab and Shift+Tab keep focus trapped inside the dialog', async () => {
  renderDialog();
  const first = screen.getByRole('button', { name: '第一个按钮' });
  const last = screen.getByRole('button', { name: '最后一个按钮' });

  // 焦点陷阱在挂载后把初始焦点落到面板内第一个可聚焦元素
  await waitFor(() => expect(first).toHaveFocus());

  // 在最后一个元素上 Tab → 回到第一个
  fireEvent.keyDown(last, { key: 'Tab' });
  expect(first).toHaveFocus();

  // 在第一个元素上 Shift+Tab → 跳到最后一个
  fireEvent.keyDown(first, { key: 'Tab', shiftKey: true });
  expect(last).toHaveFocus();
});
