import { useEffect, useMemo, useRef, useState, type RefObject } from 'react';

import type { SessionSummary } from '../types';

interface SessionSwitcherProps {
  sessions: SessionSummary[];
  activeSessionId: number | null;
  isOpen: boolean;
  isLoading: boolean;
  error: string;
  isDemo: boolean;
  searchInputRef: RefObject<HTMLInputElement>;
  onToggle: () => void;
  onClose: () => void;
  onSelect: (sessionId: number | null) => void;
  onCreate: () => Promise<void> | void;
  onRetry: () => Promise<void> | void;
}

export default function SessionSwitcher({
  sessions,
  activeSessionId,
  isOpen,
  isLoading,
  error,
  isDemo,
  searchInputRef,
  onToggle,
  onClose,
  onSelect,
  onCreate,
  onRetry,
}: SessionSwitcherProps) {
  const panelRef = useRef<HTMLDivElement | null>(null);
  const [searchValue, setSearchValue] = useState('');

  const activeSession = sessions.find((item) => item.id === activeSessionId) ?? null;
  const filteredSessions = useMemo(() => {
    const keyword = searchValue.trim().toLowerCase();
    if (!keyword) return sessions;
    return sessions.filter((item) => item.title.toLowerCase().includes(keyword));
  }, [searchValue, sessions]);

  useEffect(() => {
    if (!isOpen) return undefined;
    function handleClick(event: MouseEvent) {
      if (!panelRef.current) return;
      if (panelRef.current.contains(event.target as Node)) return;
      onClose();
    }
    document.addEventListener('mousedown', handleClick);
    return () => {
      document.removeEventListener('mousedown', handleClick);
    };
  }, [isOpen, onClose]);

  useEffect(() => {
    if (!isOpen) return;
    if (!searchInputRef.current) return;
    searchInputRef.current.focus();
  }, [isOpen, searchInputRef]);

  useEffect(() => {
    if (isOpen) return;
    setSearchValue('');
  }, [isOpen]);

  return (
    <div className="SessionSwitcher">
      <button
        type="button"
        className="SessionSwitcherButton"
        aria-expanded={isOpen}
        aria-controls="session-switcher-panel"
        onClick={onToggle}
      >
        <span className="SessionSwitcherLabel">会话</span>
        <span className="SessionSwitcherValue">
          {activeSession?.title ?? '未命名会话'}
        </span>
      </button>
      <button
        type="button"
        className="SessionSwitcherNew"
        onClick={async () => {
          await onCreate();
          onClose();
        }}
      >
        新建会话
      </button>
      {isOpen ? (
        <div
          id="session-switcher-panel"
          ref={panelRef}
          className="SessionSwitcherPanel"
          role="dialog"
          aria-label="会话切换"
        >
          <div className="SessionSwitcherSearch">
            <input
              ref={searchInputRef}
              value={searchValue}
              onChange={(event) => setSearchValue(event.target.value)}
              placeholder="搜索会话"
              className="SessionSwitcherInput"
              aria-label="搜索会话"
            />
          </div>
          {error ? (
            <div className="SessionSwitcherError">
              <span>{error}</span>
              <button type="button" className="WorkspaceLinkButton" onClick={onRetry}>
                重试
              </button>
            </div>
          ) : null}
          <div className="SessionSwitcherList" role="listbox" aria-label="会话列表">
            {isLoading ? (
              <div className="SessionSwitcherEmpty">加载会话中…</div>
            ) : filteredSessions.length === 0 ? (
              <div className="SessionSwitcherEmpty">
                {searchValue ? '未找到匹配会话' : '暂无会话记录'}
              </div>
            ) : (
              filteredSessions.map((item) => (
                <button
                  type="button"
                  key={item.id}
                  role="option"
                  aria-selected={item.id === activeSessionId}
                  className={`SessionSwitcherOption ${
                    item.id === activeSessionId ? 'isActive' : ''
                  }`}
                  onClick={() => {
                    onSelect(item.id);
                    onClose();
                  }}
                >
                  <div className="SessionSwitcherOptionTitle">{item.title}</div>
                  <div className="SessionSwitcherOptionMeta">{item.updatedAt}</div>
                </button>
              ))
            )}
          </div>
          {isDemo ? (
            <div className="WorkspaceTiny">演示模式下会话仅在前端保存。</div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
