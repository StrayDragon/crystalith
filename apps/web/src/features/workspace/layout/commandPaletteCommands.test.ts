// covers: r396（workspace-ui-core）——命令面板命令集始终含核心动作，且随运行时 capability（slides 工具、导出前置条件、桌面布局）动态变化。
import { expect, test, rs } from '@rstest/core';

import {
  buildCommandPaletteCommands,
  type CommandPaletteBuilderInput,
} from './commandPaletteCommands';
import { WIDGET_REGISTRY, type CommandItem } from './modular-canvas';

function makeInput(
  overrides: Partial<CommandPaletteBuilderInput> = {},
): CommandPaletteBuilderInput {
  return {
    notebookList: [
      { id: 1, title: '研究笔记' },
      { id: 2, title: '会议记录' },
    ],
    activeNotebookId: 1,
    setActiveNotebookId: rs.fn((id: number) => id),
    onCreateNotebook: rs.fn(),
    onOpenUpload: rs.fn(),
    onOpenUrlImport: rs.fn(),
    onFocusSourceSearch: rs.fn(),
    onStartSession: rs.fn(),
    activeSessionId: null,
    isConnected: true,
    exportQaMarkdown: rs.fn(),
    exportQaJson: rs.fn(),
    outputId: null,
    exportOutputMarkdown: rs.fn(),
    exportOutputJson: rs.fn(),
    hasSlidesTool: false,
    onOpenSlidesDialog: rs.fn(),
    onOpenSlidesRecovery: rs.fn(),
    onOpenDiagnostics: rs.fn(),
    onOpenShortcutHelp: rs.fn(),
    isDesktopLayout: false,
    activeWidgetIds: [],
    canvas: null,
    locked: false,
    onToggleLock: rs.fn(),
    onOpenSessionSearch: rs.fn(),
    ...overrides,
  };
}

function idsOf(cmds: CommandItem[]): string[] {
  return cmds.map((cmd) => cmd.id);
}

function cmdOf(cmds: CommandItem[], id: string): CommandItem {
  const found = cmds.find((cmd) => cmd.id === id);
  expect(found).toBeDefined();
  return found as CommandItem;
}

test('always includes the core workflow action set', () => {
  const input = makeInput();
  const cmds = buildCommandPaletteCommands(input);
  const ids = new Set(idsOf(cmds));

  for (const id of [
    'create-notebook',
    'switch-notebook-1',
    'switch-notebook-2',
    'import-sources-upload',
    'import-sources-url',
    'import-sources-search',
    'start-session',
    'open-diagnostics',
    'shortcut-help',
    'session-search',
  ]) {
    expect(ids.has(id)).toBe(true);
  }

  // 当前笔记本标记（当前），其余为可切换目标
  expect(cmdOf(cmds, 'switch-notebook-1').label).toBe('切换笔记本: 研究笔记（当前）');
  expect(cmdOf(cmds, 'switch-notebook-2').label).toBe('切换笔记本: 会议记录');

  // 动作接线：核心命令触发对应回调
  cmdOf(cmds, 'create-notebook').action();
  expect(input.onCreateNotebook).toHaveBeenCalledTimes(1);
  cmdOf(cmds, 'switch-notebook-2').action();
  expect(input.setActiveNotebookId).toHaveBeenCalledWith(2);
  cmdOf(cmds, 'import-sources-upload').action();
  expect(input.onOpenUpload).toHaveBeenCalledTimes(1);
  cmdOf(cmds, 'import-sources-search').action();
  expect(input.onFocusSourceSearch).toHaveBeenCalledTimes(1);
  cmdOf(cmds, 'start-session').action();
  expect(input.onStartSession).toHaveBeenCalledTimes(1);
});

test('slides command follows the runtime slides capability', () => {
  const withTool = makeInput({ hasSlidesTool: true });
  const withToolCmds = buildCommandPaletteCommands(withTool);
  expect(idsOf(withToolCmds)).toContain('open-slides-studio');
  expect(idsOf(withToolCmds)).not.toContain('recover-slides-workflow');
  cmdOf(withToolCmds, 'open-slides-studio').action();
  expect(withTool.onOpenSlidesDialog).toHaveBeenCalledTimes(1);

  const withoutTool = makeInput({ hasSlidesTool: false });
  const withoutToolCmds = buildCommandPaletteCommands(withoutTool);
  expect(idsOf(withoutToolCmds)).toContain('recover-slides-workflow');
  expect(idsOf(withoutToolCmds)).not.toContain('open-slides-studio');
  cmdOf(withoutToolCmds, 'recover-slides-workflow').action();
  expect(withoutTool.onOpenSlidesRecovery).toHaveBeenCalledTimes(1);
});

test('session export commands require notebook + session + connection', () => {
  const noSession = idsOf(buildCommandPaletteCommands(makeInput({ activeSessionId: null })));
  expect(noSession).not.toContain('export-qa-markdown');
  expect(noSession).not.toContain('export-qa-json');

  const offline = idsOf(
    buildCommandPaletteCommands(makeInput({ activeSessionId: 9, isConnected: false })),
  );
  expect(offline).not.toContain('export-qa-markdown');

  const ready = idsOf(
    buildCommandPaletteCommands(makeInput({ activeSessionId: 9, isConnected: true })),
  );
  expect(ready).toContain('export-qa-markdown');
  expect(ready).toContain('export-qa-json');
});

test('output export commands require an available output id', () => {
  const withoutOutput = idsOf(
    buildCommandPaletteCommands(makeInput({ activeSessionId: 9, outputId: null })),
  );
  expect(withoutOutput).not.toContain('export-output-markdown');
  expect(withoutOutput).not.toContain('export-output-json');

  const withOutput = idsOf(
    buildCommandPaletteCommands(makeInput({ activeSessionId: 9, outputId: 5 })),
  );
  expect(withOutput).toContain('export-output-markdown');
  expect(withOutput).toContain('export-output-json');
});

test('widget management and lock commands exist only on desktop layout', () => {
  const canvas = { addWidget: rs.fn(), removeWidget: rs.fn() };

  const mobile = idsOf(buildCommandPaletteCommands(makeInput({ isDesktopLayout: false })));
  expect(mobile.filter((id) => id.startsWith('add-') || id.startsWith('remove-'))).toEqual([]);
  expect(mobile).not.toContain('toggle-lock');

  const desktop = buildCommandPaletteCommands(
    makeInput({ isDesktopLayout: true, activeWidgetIds: ['chat'], canvas }),
  );
  const desktopIds = idsOf(desktop);
  // 已挂载模块给移除命令，未挂载模块给添加命令
  expect(desktopIds).toContain('remove-chat');
  expect(desktopIds).not.toContain('add-chat');
  expect(desktopIds).toContain('add-sources');
  expect(desktopIds).toContain('add-studio');
  expect(desktopIds).toContain('toggle-lock');

  // add/remove 命令集合由 WIDGET_REGISTRY 驱动
  expect(desktopIds.filter((id) => id.startsWith('add-') || id.startsWith('remove-'))).toHaveLength(
    Object.keys(WIDGET_REGISTRY).length,
  );

  cmdOf(desktop, 'add-sources').action();
  expect(canvas.addWidget).toHaveBeenCalledWith('sources');
  cmdOf(desktop, 'remove-chat').action();
  expect(canvas.removeWidget).toHaveBeenCalledWith('chat');
});
