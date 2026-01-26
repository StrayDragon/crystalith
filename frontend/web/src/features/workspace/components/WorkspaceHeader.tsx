import { useRef, useState } from 'react';
import { Tooltip } from '@material-tailwind/react';
import { Hub as HubIcon } from '@mui/icons-material';

import type { AsyncStatus } from '../../../shared/types';
import type { Notebook } from '../types';
import NotebookSwitcher from './NotebookSwitcher';

interface WorkspaceHeaderProps {
  notebooks: Notebook[];
  activeNotebookId: number | null;
  isNotebooksLoading: boolean;
  notebooksError: string;
  createName: string;
  createState: AsyncStatus;
  createError: string;
  isDemo: boolean;
  onCreateNameChange: (value: string) => void;
  onCreateNotebook: () => Promise<boolean>;
  onUpdateNotebook?: (notebookId: number, name: string) => Promise<boolean>;
  onDeleteNotebook?: (notebookId: number) => Promise<boolean>;
  onSelectNotebook: (notebookId: number | null) => void;
  onOpenKnowledgeGraph?: () => void;
}

export default function WorkspaceHeader({
  notebooks,
  activeNotebookId,
  isNotebooksLoading,
  notebooksError,
  createName,
  createState,
  createError,
  isDemo,
  onCreateNameChange,
  onCreateNotebook,
  onUpdateNotebook,
  onDeleteNotebook,
  onSelectNotebook,
  onOpenKnowledgeGraph,
}: WorkspaceHeaderProps) {
  const [notebookSwitcherOpen, setNotebookSwitcherOpen] = useState(false);
  const notebookSearchRef = useRef<HTMLInputElement | null>(null);

  return (
    <header className="flex items-center justify-between gap-3 px-3 py-2 sm:px-4 sm:py-2.5 bg-white border border-gray-300 rounded-xl shadow-sm flex-wrap">
      {/* Left Section - Logo & Title */}
      <div className="flex items-center gap-3 min-w-0">
        {/* Logo */}
        <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-white shadow-sm border border-gray-100 text-gray-900">
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

        {/* Title with Notebook Switcher */}
        <NotebookSwitcher
          notebooks={notebooks}
          activeNotebookId={activeNotebookId}
          isOpen={notebookSwitcherOpen}
          isLoading={isNotebooksLoading}
          error={notebooksError}
          isDemo={isDemo}
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

      {/* Right Section - Actions & Avatar */}
      <div className="flex items-center gap-2">
        {/* Knowledge Graph Button */}
        {onOpenKnowledgeGraph && (
          <Tooltip content="知识图谱">
            <button
              type="button"
              onClick={onOpenKnowledgeGraph}
              className="flex items-center justify-center w-8 h-8 rounded-lg bg-gray-50 hover:bg-blue-50 border border-gray-200 hover:border-blue-200 text-gray-600 hover:text-blue-600 transition-colors"
            >
              <HubIcon style={{ fontSize: 18 }} />
            </button>
          </Tooltip>
        )}

        {/* User Avatar */}
        <div className="p-0.5 border-2 border-gray-100 rounded-full cursor-pointer">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center text-white font-semibold text-sm">
            CL
          </div>
        </div>
      </div>
    </header>
  );
}
