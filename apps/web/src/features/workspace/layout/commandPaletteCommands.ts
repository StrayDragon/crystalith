/**
 * Command palette command list builder (W6): pure input → CommandItem[] so
 * WorkspaceLayout no longer owns the ~180-line catalog inline.
 */
import { WIDGET_REGISTRY, type CommandItem } from './modular-canvas';

export interface CommandPaletteBuilderInput {
  notebookList: Array<{ id: number; title: string }>;
  activeNotebookId: number | null;
  setActiveNotebookId: (id: number) => void;
  onCreateNotebook: () => void;
  onOpenUpload: () => void;
  onOpenUrlImport: () => void;
  onFocusSourceSearch: () => void;
  onStartSession: () => void;
  activeSessionId: number | null;
  isConnected: boolean;
  exportQaMarkdown: () => void;
  exportQaJson: () => void;
  outputId: number | null;
  exportOutputMarkdown: () => void;
  exportOutputJson: () => void;
  hasSlidesTool: boolean;
  onOpenSlidesDialog: () => void;
  onOpenSlidesRecovery: () => void;
  onOpenDiagnostics: () => void;
  onOpenShortcutHelp: () => void;
  isDesktopLayout: boolean;
  activeWidgetIds: string[];
  canvas: { addWidget: (id: string) => void; removeWidget: (id: string) => void } | null;
  locked: boolean;
  onToggleLock: () => void;
  onOpenSessionSearch: () => void;
}

export function buildCommandPaletteCommands(input: CommandPaletteBuilderInput): CommandItem[] {
  const cmds: CommandItem[] = [];

  // Core workspace actions
  cmds.push({
    id: 'create-notebook',
    label: '新建笔记本',
    icon: '📓',
    action: input.onCreateNotebook,
  });

  input.notebookList.slice(0, 12).forEach((notebook) => {
    cmds.push({
      id: `switch-notebook-${notebook.id}`,
      label:
        notebook.id === input.activeNotebookId
          ? `切换笔记本: ${notebook.title}（当前）`
          : `切换笔记本: ${notebook.title}`,
      icon: notebook.id === input.activeNotebookId ? '✅' : '📓',
      action: () => {
        input.setActiveNotebookId(notebook.id);
      },
    });
  });

  cmds.push({
    id: 'import-sources-upload',
    label: '导入来源: 上传文件',
    icon: '⬆️',
    action: input.onOpenUpload,
  });

  cmds.push({
    id: 'import-sources-url',
    label: '导入来源: 从 URL',
    icon: '🔗',
    action: input.onOpenUrlImport,
  });

  cmds.push({
    id: 'import-sources-search',
    label: '导入来源: 搜索',
    icon: '🔍',
    action: input.onFocusSourceSearch,
  });

  cmds.push({
    id: 'start-session',
    label: '开始会话',
    icon: '💬',
    action: input.onStartSession,
  });

  if (input.activeNotebookId && input.activeSessionId && input.isConnected) {
    cmds.push({
      id: 'export-qa-markdown',
      label: '导出当前会话（Markdown，含引用）',
      icon: '⬇️',
      action: input.exportQaMarkdown,
    });

    cmds.push({
      id: 'export-qa-json',
      label: '导出当前会话（JSON，含引用）',
      icon: '⬇️',
      action: input.exportQaJson,
    });
  }

  if (input.activeNotebookId && input.isConnected && input.outputId) {
    cmds.push({
      id: 'export-output-markdown',
      label: '导出当前 Output（Markdown，含引用）',
      icon: '📝',
      action: input.exportOutputMarkdown,
    });

    cmds.push({
      id: 'export-output-json',
      label: '导出当前 Output（JSON，含引用）',
      icon: '🧾',
      action: input.exportOutputJson,
    });
  }

  cmds.push({
    id: input.hasSlidesTool ? 'open-slides-studio' : 'recover-slides-workflow',
    label: input.hasSlidesTool ? '打开 Slides Studio' : '查看 Slides 诊断 / 安装指引',
    icon: '🖼️',
    action: input.hasSlidesTool ? input.onOpenSlidesDialog : input.onOpenSlidesRecovery,
  });

  cmds.push({
    id: 'open-diagnostics',
    label: '健康 / 诊断',
    icon: '🩺',
    action: input.onOpenDiagnostics,
  });

  cmds.push({
    id: 'shortcut-help',
    label: '快捷键帮助',
    icon: '⌨️',
    action: input.onOpenShortcutHelp,
  });

  if (input.isDesktopLayout) {
    Object.entries(WIDGET_REGISTRY).forEach(([id, meta]) => {
      const isActive = input.activeWidgetIds.includes(id);
      if (!isActive) {
        cmds.push({
          id: `add-${id}`,
          label: `添加模块: ${meta.label}`,
          icon: meta.icon,
          action: () => {
            input.canvas?.addWidget(id);
          },
        });
      } else {
        cmds.push({
          id: `remove-${id}`,
          label: `移除模块: ${meta.label}`,
          icon: meta.icon,
          action: () => {
            input.canvas?.removeWidget(id);
          },
        });
      }
    });

    cmds.push({
      id: 'toggle-lock',
      label: input.locked ? '解锁布局（进入编辑模式）' : '锁定布局',
      icon: input.locked ? '🔓' : '🔒',
      action: input.onToggleLock,
    });
  }

  cmds.push({
    id: 'session-search',
    label: '切换会话',
    icon: '💬',
    action: input.onOpenSessionSearch,
  });

  return cmds;
}
