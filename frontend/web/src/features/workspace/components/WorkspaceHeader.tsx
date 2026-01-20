import { useEffect, useRef, useState } from 'react';

import type { AsyncStatus } from '../../../shared/types';

interface WorkspaceHeaderProps {
  title: string;
  createName: string;
  createState: AsyncStatus;
  createError: string;
  isDemo: boolean;
  onCreateNameChange: (value: string) => void;
  onCreateNotebook: () => Promise<boolean>;
}

export default function WorkspaceHeader({
  title,
  createName,
  createState,
  createError,
  isDemo,
  onCreateNameChange,
  onCreateNotebook,
}: WorkspaceHeaderProps) {
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const isCreating = createState === 'loading';
  const createDisabled = isDemo || isCreating || createName.trim().length === 0;

  async function handleCreate() {
    if (createDisabled) return;
    const created = await onCreateNotebook();
    if (created) {
      setIsCreateOpen(false);
    }
  }

  useEffect(() => {
    if (!isCreateOpen) return undefined;
    function handleClick(event: MouseEvent) {
      if (!panelRef.current) return;
      if (panelRef.current.contains(event.target as Node)) return;
      setIsCreateOpen(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => {
      document.removeEventListener('mousedown', handleClick);
    };
  }, [isCreateOpen]);

  return (
    <header className="WorkspaceTopBar">
      <div className="WorkspaceTopBar__left">
        <span className="WorkspaceLogo" aria-hidden="true">
          <svg viewBox="0 0 24 24" focusable="false">
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
        </span>
        <h1 className="WorkspaceTopBar__title" title={title}>
          {title}
        </h1>
      </div>

      <div className="WorkspaceTopBar__right">
        <div className="WorkspaceCreate" ref={panelRef}>
          <button
            type="button"
            className="WorkspacePrimaryAction"
            onClick={() => setIsCreateOpen((open) => !open)}
            disabled={isDemo}
            aria-expanded={isCreateOpen}
            aria-controls="workspace-create-panel"
          >
            <span className="WorkspacePrimaryAction__icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" focusable="false">
                <path
                  d="M12 5v14M5 12h14"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                />
              </svg>
            </span>
            {isCreating ? '创建中…' : '创建笔记本'}
          </button>
          {isCreateOpen ? (
            <div id="workspace-create-panel" className="WorkspaceCreatePanel" role="dialog">
              <label className="WorkspaceCreateLabel" htmlFor="workspace-create-input">
                笔记本名称
              </label>
              <input
                id="workspace-create-input"
                className="WorkspaceCreateInput"
                value={createName}
                onChange={(event) => onCreateNameChange(event.target.value)}
                placeholder={isDemo ? '演示模式不可创建' : '输入名称'}
                disabled={isDemo || isCreating}
                onKeyDown={(event) => {
                  if (event.key !== 'Enter') return;
                  event.preventDefault();
                  void handleCreate();
                }}
              />
              {createError ? <div className="WorkspaceCreateHint">{createError}</div> : null}
              {isDemo ? (
                <div className="WorkspaceCreateHint isMuted">演示模式下无法创建笔记本。</div>
              ) : null}
              <div className="WorkspaceCreateActions">
                <button
                  type="button"
                  className="WorkspaceSecondaryAction"
                  onClick={() => setIsCreateOpen(false)}
                >
                  取消
                </button>
                <button
                  type="button"
                  className="WorkspacePrimaryAction"
                  disabled={createDisabled}
                  onClick={handleCreate}
                >
                  创建
                </button>
              </div>
            </div>
          ) : null}
        </div>
        <button type="button" className="WorkspaceAvatar" aria-label="个人账户">
          <span className="WorkspaceAvatar__ring" aria-hidden="true" />
          <span className="WorkspaceAvatar__inner" aria-hidden="true">
            CL
          </span>
        </button>
      </div>
    </header>
  );
}
