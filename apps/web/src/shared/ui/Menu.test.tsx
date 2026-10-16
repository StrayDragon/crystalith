import { expect, rs, test } from '@rstest/core';
import { fireEvent, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';

import { TestProviders } from '../../test-utils/providers';
import ConfirmPopover from '../ConfirmPopover';
import { Button, Menu, MenuHandler, MenuItem, MenuList } from './index';

// covers: r492 — 瞬态容器（菜单）内触发的交互弹层须在容器关闭后仍渲染

function renderMenu(item: ReactNode) {
  return render(
    <TestProviders>
      <Menu>
        <MenuHandler>
          <Button>操作</Button>
        </MenuHandler>
        <MenuList>{item}</MenuList>
      </Menu>
    </TestProviders>,
  );
}

test('menu-nested ConfirmPopover stays mounted and renders after item press (keepMenuOpen)', async () => {
  const onConfirm = rs.fn();
  renderMenu(
    <ConfirmPopover message="确定删除吗？" onConfirm={onConfirm}>
      <MenuItem keepMenuOpen data-testid="danger-item">
        删除
      </MenuItem>
    </ConfirmPopover>,
  );

  fireEvent.click(screen.getByText('操作'));
  fireEvent.click(await screen.findByTestId('danger-item'));

  // keepMenuOpen: the menu stays open, so the item (and its popover) survive
  expect(screen.getByTestId('danger-item')).toBeInTheDocument();
  fireEvent.click(await screen.findByTestId('confirm-popover-confirm'));
  expect(onConfirm).toHaveBeenCalledTimes(1);
});

test('menu closes on item press by default (keepMenuOpen unset)', async () => {
  renderMenu(<MenuItem data-testid="plain-item">普通项</MenuItem>);

  fireEvent.click(screen.getByText('操作'));
  fireEvent.click(await screen.findByTestId('plain-item'));

  expect(screen.queryByTestId('plain-item')).not.toBeInTheDocument();
});
