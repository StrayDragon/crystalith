export type ShortcutCategory = '导航' | '操作' | '编辑';

export type WorkspaceShortcutId =
  | 'open-search'
  | 'create-notebook'
  | 'focus-sources'
  | 'focus-chat'
  | 'focus-studio'
  | 'send-message'
  | 'close-overlay'
  | 'open-shortcut-help';

export interface WorkspaceShortcutDefinition {
  id: WorkspaceShortcutId;
  combo: string;
  description: string;
  category: ShortcutCategory;
  allowInInput?: boolean;
}

export const WORKSPACE_SHORTCUTS: WorkspaceShortcutDefinition[] = [
  {
    id: 'open-search',
    combo: 'Ctrl+K',
    description: '打开会话搜索面板',
    category: '导航',
  },
  {
    id: 'create-notebook',
    combo: 'Ctrl+N',
    description: '新建笔记本',
    category: '操作',
  },
  {
    id: 'focus-sources',
    combo: 'Ctrl+1',
    description: '聚焦左侧来源面板',
    category: '导航',
  },
  {
    id: 'focus-chat',
    combo: 'Ctrl+2',
    description: '聚焦中间对话面板',
    category: '导航',
  },
  {
    id: 'focus-studio',
    combo: 'Ctrl+3',
    description: '聚焦右侧 Studio 面板',
    category: '导航',
  },
  {
    id: 'send-message',
    combo: 'Ctrl+Enter',
    description: '发送消息',
    category: '编辑',
    allowInInput: true,
  },
  {
    id: 'close-overlay',
    combo: 'Escape',
    description: '关闭当前弹窗或全屏状态',
    category: '操作',
    allowInInput: true,
  },
  {
    id: 'open-shortcut-help',
    combo: 'Ctrl+?',
    description: '打开快捷键帮助',
    category: '操作',
  },
];
