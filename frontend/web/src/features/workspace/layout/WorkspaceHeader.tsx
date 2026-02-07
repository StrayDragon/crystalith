import { useRef, useState } from 'react';
import { Menu, MenuHandler, MenuItem, MenuList, Tooltip } from '@material-tailwind/react';
import {
  DarkMode as DarkModeIcon,
  Hub as HubIcon,
  LightMode as LightModeIcon,
  SettingsBrightness as SystemThemeIcon,
} from '@mui/icons-material';

import type { AsyncStatus } from '../../../shared/types';
import type { Notebook } from '../shared/types';
import { useTheme, type ThemeMode } from '../shared/hooks/useTheme';
import NotebookSwitcher from '../domains/notebooks/NotebookSwitcher';

interface WorkspaceHeaderProps {
  notebooks: Notebook[];
  activeNotebookId: number | null;
  isNotebooksLoading: boolean;
  notebooksError: string;
  createName: string;
  createState: AsyncStatus;
  createError: string;
  isConnected: boolean;
  onCreateNameChange: (value: string) => void;
  onCreateNotebook: () => Promise<boolean>;
  onUpdateNotebook?: (notebookId: number, name: string) => Promise<boolean>;
  onDeleteNotebook?: (notebookId: number) => Promise<boolean>;
  onSelectNotebook: (notebookId: number | null) => void;
  onOpenKnowledgeGraph?: () => void;
}

const THEME_OPTIONS: Array<{
  value: ThemeMode;
  label: string;
  Icon: typeof LightModeIcon;
}> = [
  { value: 'light', label: '浅色模式', Icon: LightModeIcon },
  { value: 'dark', label: '深色模式', Icon: DarkModeIcon },
  { value: 'system', label: '跟随系统', Icon: SystemThemeIcon },
];

export default function WorkspaceHeader({
  notebooks,
  activeNotebookId,
  isNotebooksLoading,
  notebooksError,
  createName,
  createState,
  createError,
  isConnected,
  onCreateNameChange,
  onCreateNotebook,
  onUpdateNotebook,
  onDeleteNotebook,
  onSelectNotebook,
  onOpenKnowledgeGraph,
}: WorkspaceHeaderProps) {
  const [notebookSwitcherOpen, setNotebookSwitcherOpen] = useState(false);
  const notebookSearchRef = useRef<HTMLInputElement | null>(null);
  const { theme, resolvedTheme, setTheme } = useTheme();

  const activeThemeOption = THEME_OPTIONS.find((option) => option.value === theme) ?? THEME_OPTIONS[2];
  const ThemeIcon = activeThemeOption.Icon;
  const resolvedThemeLabel = resolvedTheme === 'dark' ? '深色' : '浅色';

  return (
    <header className="flex items-center justify-between gap-3 px-3 py-2 sm:px-4 sm:py-2.5 bg-white dark:bg-slate-900 border border-gray-300 dark:border-slate-700 rounded-xl shadow-sm flex-wrap">
      <div className="flex items-center gap-3 min-w-0">
        <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-white dark:bg-slate-800 shadow-sm border border-gray-100 dark:border-slate-700 text-gray-900 dark:text-gray-100">
          <svg viewBox="0 0 24 24" width="18" height="18" focusable="false">
            <path
              d="M6 12a6 6 0 0 1 10.8-3.6"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              fill="none"
            />
            <path
              d="M8.5 12a3.5 3.5 0 0 1 6.2-2.1"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              fill="none"
            />
            <circle cx="12" cy="14.5" r="1.4" fill="currentColor" />
          </svg>
        </div>

        <NotebookSwitcher
          notebooks={notebooks}
          activeNotebookId={activeNotebookId}
          isOpen={notebookSwitcherOpen}
          isLoading={isNotebooksLoading}
          error={notebooksError}
          isConnected={isConnected}
          searchInputRef={notebookSearchRef}
          createName={createName}
          createState={createState}
          createError={createError}
          onToggle={() => setNotebookSwitcherOpen(true)}
          onClose={() => setNotebookSwitcherOpen(false)}
          onSelect={onSelectNotebook}
          onUpdate={onUpdateNotebook}
          onDelete={onDeleteNotebook}
          onCreateNameChange={onCreateNameChange}
          onCreateNotebook={onCreateNotebook}
        />
      </div>

      <div className="flex items-center gap-2">
        <Menu placement="bottom-end">
          <Tooltip content={`主题：${activeThemeOption.label}（当前 ${resolvedThemeLabel}）`}>
            <MenuHandler>
              <button
                type="button"
                aria-label="切换主题"
                className="flex items-center justify-center w-8 h-8 rounded-lg bg-gray-50 dark:bg-slate-800 hover:bg-blue-50 dark:hover:bg-slate-700 border border-gray-200 dark:border-slate-700 text-gray-600 dark:text-slate-200 hover:text-blue-600 dark:hover:text-blue-300 transition-colors"
              >
                <ThemeIcon style={{ fontSize: 18 }} />
              </button>
            </MenuHandler>
          </Tooltip>
          <MenuList className="p-1 min-w-[160px] bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 text-gray-700 dark:text-slate-200">
            {THEME_OPTIONS.map((option) => {
              const OptionIcon = option.Icon;
              const isActive = theme === option.value;

              return (
                <MenuItem
                  key={option.value}
                  onClick={() => setTheme(option.value)}
                  className={`flex items-center gap-2 py-2 px-3 text-xs ${
                    isActive
                      ? 'bg-blue-50 dark:bg-slate-700 text-blue-700 dark:text-blue-300'
                      : 'hover:bg-gray-100 dark:hover:bg-slate-800'
                  }`}
                >
                  <OptionIcon style={{ fontSize: 14 }} />
                  <span>{option.label}</span>
                </MenuItem>
              );
            })}
          </MenuList>
        </Menu>

        {onOpenKnowledgeGraph && (
          <Tooltip content="知识图谱">
            <button
              type="button"
              onClick={onOpenKnowledgeGraph}
              aria-label="打开知识图谱"
              className="flex items-center justify-center w-8 h-8 rounded-lg bg-gray-50 dark:bg-slate-800 hover:bg-blue-50 dark:hover:bg-slate-700 border border-gray-200 dark:border-slate-700 text-gray-600 dark:text-slate-200 hover:text-blue-600 dark:hover:text-blue-300 transition-colors"
            >
              <HubIcon style={{ fontSize: 18 }} />
            </button>
          </Tooltip>
        )}

        <div className="p-0.5 border-2 border-gray-100 dark:border-slate-700 rounded-full cursor-pointer">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center text-white font-semibold text-sm">
            CL
          </div>
        </div>
      </div>
    </header>
  );
}
