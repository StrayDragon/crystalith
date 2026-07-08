import type { PanelId } from '../shared/types';

interface WorkspaceTabsProps {
  activePanel: PanelId;
  onChange: (panel: PanelId) => void;
}

const tabs: { id: PanelId; label: string }[] = [
  { id: 'sources', label: '来源' },
  { id: 'chat', label: '聊天' },
  { id: 'refine', label: '笔记' },
];

export default function WorkspaceTabs({ activePanel, onChange }: WorkspaceTabsProps) {
  return (
    <nav
      className="flex items-center gap-2 px-2 pt-2 border-t border-gray-200 dark:border-slate-700 bg-white/95 dark:bg-slate-900/95 backdrop-blur"
      style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 0.5rem)' }}
      aria-label="工作区面板切换"
    >
      {tabs.map((item) => {
        const isActive = activePanel === item.id;
        return (
          <button
            key={item.id}
            type="button"
            className={`flex-1 min-w-0 flex items-center justify-center rounded-full px-3 py-2 text-xs font-semibold transition-colors ${
              isActive
                ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900'
                : 'text-gray-600 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-800'
            }`}
            aria-current={isActive ? 'page' : undefined}
            onClick={() => onChange(item.id)}
          >
            {item.label}
          </button>
        );
      })}
    </nav>
  );
}
