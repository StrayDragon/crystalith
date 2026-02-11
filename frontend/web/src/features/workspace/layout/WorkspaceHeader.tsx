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
  onCreateNotebookFromTemplate?: (templateId: number, name: string) => Promise<boolean>;
  onUpdateNotebook?: (notebookId: number, name: string) => Promise<boolean>;
  onDeleteNotebook?: (notebookId: number) => Promise<boolean>;
  onSelectNotebook: (notebookId: number | null) => void;
  onOpenKnowledgeGraph?: () => void;
  // Modular Canvas controls
  locked?: boolean;
  onToggleLock?: () => void;
  onOpenCatalog?: () => void;
  onOpenCommandPalette?: () => void;
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
  onCreateNotebookFromTemplate,
  onUpdateNotebook,
  onDeleteNotebook,
  onSelectNotebook,
  onOpenKnowledgeGraph,
  locked,
  onToggleLock,
  onOpenCatalog,
  onOpenCommandPalette,
}: WorkspaceHeaderProps) {
  const [notebookSwitcherOpen, setNotebookSwitcherOpen] = useState(false);
  const notebookSearchRef = useRef<HTMLInputElement | null>(null);
  const { theme, setTheme } = useTheme();

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
          onCreateNotebookFromTemplate={onCreateNotebookFromTemplate}
        />
      </div>

      <div className="flex items-center gap-1.5">
        {/* Subtle lock status indicator */}
        {onToggleLock && (
          <Tooltip content={locked ? '布局已锁定 · 点击解锁' : '布局编辑中 · 点击锁定'}>
            <button
              type="button"
              onClick={onToggleLock}
              aria-label={locked ? '解锁布局' : '锁定布局'}
              className={`flex items-center justify-center w-7 h-7 rounded-md transition-all ${
                locked
                  ? 'text-gray-300 dark:text-slate-600 hover:text-gray-500 dark:hover:text-slate-400'
                  : 'text-amber-500 dark:text-amber-400 bg-amber-50/60 dark:bg-amber-900/15 hover:bg-amber-100 dark:hover:bg-amber-900/25'
              }`}
            >
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                {locked ? (
                  <>
                    <rect x="3" y="7" width="10" height="7" rx="1.5" />
                    <path d="M5 7V5a3 3 0 0 1 6 0v2" />
                  </>
                ) : (
                  <>
                    <rect x="3" y="7" width="10" height="7" rx="1.5" />
                    <path d="M5 7V5a3 3 0 0 1 6 0" />
                  </>
                )}
              </svg>
            </button>
          </Tooltip>
        )}

        {/* Avatar dropdown — consolidates all controls */}
        <Menu placement="bottom-end">
          <MenuHandler>
            <button type="button" className="p-0.5 border-2 border-gray-100 dark:border-slate-700 rounded-full cursor-pointer hover:border-gray-300 dark:hover:border-slate-500 transition-colors">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center text-white font-semibold text-sm">
                CL
              </div>
            </button>
          </MenuHandler>
          <MenuList className="p-1.5 min-w-[200px] bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 text-gray-700 dark:text-slate-200 rounded-xl shadow-lg">
            {/* Layout section */}
            <div className="px-2 pt-1 pb-1.5">
              <span className="text-[10px] font-semibold text-gray-400 dark:text-slate-500 uppercase tracking-wider">布局</span>
            </div>
            {onOpenCatalog && (
              <MenuItem
                onClick={onOpenCatalog}
                className="flex items-center gap-2.5 py-2 px-3 text-xs rounded-lg hover:bg-gray-100 dark:hover:bg-slate-800"
              >
                <span className="text-sm w-5 text-center">⚙️</span>
                <span>模块管理</span>
              </MenuItem>
            )}

            <hr className="my-1.5 border-gray-100 dark:border-slate-700" />

            {/* Tools section */}
            <div className="px-2 pt-1 pb-1.5">
              <span className="text-[10px] font-semibold text-gray-400 dark:text-slate-500 uppercase tracking-wider">工具</span>
            </div>
            {onOpenCommandPalette && (
              <MenuItem
                onClick={onOpenCommandPalette}
                className="flex items-center gap-2.5 py-2 px-3 text-xs rounded-lg hover:bg-gray-100 dark:hover:bg-slate-800"
              >
                <span className="text-sm w-5 text-center">⌨️</span>
                <span className="flex-1">命令面板</span>
                <kbd className="ml-auto text-[10px] px-1.5 py-0.5 bg-gray-100 dark:bg-slate-800 rounded text-gray-400 dark:text-slate-500 font-mono">⌘K</kbd>
              </MenuItem>
            )}
            {onOpenKnowledgeGraph && (
              <MenuItem
                onClick={onOpenKnowledgeGraph}
                className="flex items-center gap-2.5 py-2 px-3 text-xs rounded-lg hover:bg-gray-100 dark:hover:bg-slate-800"
              >
                <HubIcon style={{ fontSize: 16, marginLeft: 2 }} className="text-gray-500 dark:text-slate-400" />
                <span>知识图谱</span>
              </MenuItem>
            )}

            <hr className="my-1.5 border-gray-100 dark:border-slate-700" />

            {/* Theme section */}
            <div className="px-2 pt-1 pb-1.5">
              <span className="text-[10px] font-semibold text-gray-400 dark:text-slate-500 uppercase tracking-wider">外观</span>
            </div>
            {THEME_OPTIONS.map((option) => {
              const OptionIcon = option.Icon;
              const isActive = theme === option.value;

              return (
                <MenuItem
                  key={option.value}
                  onClick={() => setTheme(option.value)}
                  className={`flex items-center gap-2.5 py-2 px-3 text-xs rounded-lg ${
                    isActive
                      ? 'bg-blue-50 dark:bg-slate-700 text-blue-700 dark:text-blue-300'
                      : 'hover:bg-gray-100 dark:hover:bg-slate-800'
                  }`}
                >
                  <OptionIcon style={{ fontSize: 14, marginLeft: 2 }} />
                  <span>{option.label}</span>
                  {isActive && (
                    <span className="ml-auto text-[10px] text-blue-400 dark:text-blue-500">✓</span>
                  )}
                </MenuItem>
              );
            })}
          </MenuList>
        </Menu>
      </div>
    </header>
  );
}
