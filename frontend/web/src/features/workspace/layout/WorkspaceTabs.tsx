import type { PanelId } from '../shared/types';

interface WorkspaceTabsProps {
  activePanel: PanelId;
  onChange: (panel: PanelId) => void;
}

const tabs: { id: PanelId; label: string }[] = [
  { id: 'sources', label: '来源' },
  { id: 'chat', label: '聊天' },
  { id: 'refine', label: '输出中心' },
];

export default function WorkspaceTabs({ activePanel, onChange }: WorkspaceTabsProps) {
  return (
    <nav className="WorkspaceTabs" aria-label="工作区面板切换">
      {tabs.map((item) => (
        <button
          key={item.id}
          type="button"
          className={`WorkspaceTab ${activePanel === item.id ? 'isActive' : ''}`}
          aria-current={activePanel === item.id ? 'page' : undefined}
          onClick={() => onChange(item.id)}
        >
          {item.label}
        </button>
      ))}
    </nav>
  );
}
