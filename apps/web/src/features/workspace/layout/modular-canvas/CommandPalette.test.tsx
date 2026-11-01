// covers: r396（workspace-ui-core）——Ctrl+K 经全局快捷键绑定打开命令面板并聚焦输入，command-palette-input 可检索过滤命令。
import { expect, test, rs } from '@rstest/core';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { useState } from 'react';

import { TestProviders } from '../../../../test-utils/providers';
import { useKeyboardShortcuts } from '../../shared/hooks/useKeyboardShortcuts';
import CommandPalette, { type CommandItem } from './CommandPalette';

function makeCommands(): CommandItem[] {
  return [
    { id: 'create-notebook', label: '新建笔记本', icon: '📓', action: rs.fn() },
    { id: 'import-sources-url', label: '导入来源: 从 URL', icon: '🔗', action: rs.fn() },
    { id: 'shortcut-help', label: '快捷键帮助', icon: '⌨️', action: rs.fn() },
  ];
}

/** 复刻 WorkspaceLayout 的 Ctrl+K 绑定（allowInInput）并挂载命令面板。 */
function PaletteHost({ commands }: { commands: CommandItem[] }) {
  const [open, setOpen] = useState(false);
  useKeyboardShortcuts([
    {
      id: 'open-command-palette',
      combo: 'Ctrl+K',
      allowInInput: true,
      handler: () => {
        setOpen((prev) => !prev);
      },
    },
  ]);
  return <CommandPalette open={open} onClose={() => setOpen(false)} commands={commands} />;
}

function renderPalette(commands: CommandItem[]) {
  return render(
    <TestProviders>
      <PaletteHost commands={commands} />
    </TestProviders>,
  );
}

test('Ctrl+K opens the palette with a focused search input', async () => {
  renderPalette(makeCommands());
  expect(screen.queryByTestId('command-palette')).not.toBeInTheDocument();

  fireEvent.keyDown(window, { key: 'k', ctrlKey: true });

  expect(await screen.findByTestId('command-palette')).toBeInTheDocument();
  const input = screen.getByTestId('command-palette-input');
  await waitFor(() => expect(input).toHaveFocus());
});

test('typing in the palette input filters commands and shows the no-match state', async () => {
  renderPalette(makeCommands());
  fireEvent.keyDown(window, { key: 'k', ctrlKey: true });
  const input = await screen.findByTestId('command-palette-input');

  // 打开后全量命令可见
  expect(screen.getByText('新建笔记本')).toBeInTheDocument();
  expect(screen.getByText('导入来源: 从 URL')).toBeInTheDocument();
  expect(screen.getByText('快捷键帮助')).toBeInTheDocument();

  // 检索过滤：只留匹配项
  fireEvent.change(input, { target: { value: 'URL' } });
  expect(screen.getByText('导入来源: 从 URL')).toBeInTheDocument();
  expect(screen.queryByText('新建笔记本')).not.toBeInTheDocument();
  expect(screen.queryByText('快捷键帮助')).not.toBeInTheDocument();

  // 无匹配空态
  fireEvent.change(input, { target: { value: '不存在的命令词' } });
  expect(screen.getByText('无匹配命令')).toBeInTheDocument();
});

test('running a filtered command executes its action and closes the palette', async () => {
  const commands = makeCommands();
  renderPalette(commands);
  fireEvent.keyDown(window, { key: 'k', ctrlKey: true });
  const input = await screen.findByTestId('command-palette-input');

  fireEvent.change(input, { target: { value: 'URL' } });
  fireEvent.click(screen.getByText('导入来源: 从 URL'));

  expect(commands[1].action).toHaveBeenCalledTimes(1);
  expect(screen.queryByTestId('command-palette')).not.toBeInTheDocument();
});
