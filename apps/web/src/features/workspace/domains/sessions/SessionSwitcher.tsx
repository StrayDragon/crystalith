import {
  IconButton,
  Popover,
  PopoverHandler,
  PopoverContent,
  Typography,
  Spinner,
} from '@material-tailwind/react';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Check as CheckIcon,
  Close as CloseIcon,
  Search as SearchIcon,
  ExpandMore as ExpandMoreIcon,
} from '@mui/icons-material';
import { useEffect, useMemo, useRef, useState, type RefObject } from 'react';

import ConfirmPopover from '../../../../shared/ConfirmPopover';
import { LAYER_LEVELS } from '../../../../shared/layer';
import type { SessionSummary } from '../../shared/types';

interface SessionSwitcherProps {
  sessions: SessionSummary[];
  activeSessionId: number | null;
  isOpen: boolean;
  isLoading: boolean;
  error: string;
  isConnected: boolean;
  searchInputRef: RefObject<HTMLInputElement | null>;
  onToggle: () => void;
  onClose: () => void;
  onSelect: (sessionId: number | null) => void;
  onCreate: () => Promise<void> | void;
  onUpdate?: (sessionId: number, title: string) => Promise<boolean>;
  onDelete?: (sessionId: number) => Promise<boolean>;
  onRetry: () => Promise<void> | void;
}

export default function SessionSwitcher({
  sessions,
  activeSessionId,
  isOpen,
  isLoading,
  error,
  isConnected,
  searchInputRef,
  onToggle,
  onClose,
  onSelect,
  onCreate,
  onUpdate,
  onDelete,
  onRetry,
}: SessionSwitcherProps) {
  const [searchValue, setSearchValue] = useState('');
  const [editingSessionId, setEditingSessionId] = useState<number | null>(null);
  const [editingTitle, setEditingTitle] = useState('');
  const [isUpdating, setIsUpdating] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const editInputRef = useRef<HTMLInputElement | null>(null);

  const activeSession = sessions.find((item) => item.id === activeSessionId) ?? null;
  const filteredSessions = useMemo(() => {
    const keyword = searchValue.trim().toLowerCase();
    if (!keyword) return sessions;
    return sessions.filter((item) => item.title.toLowerCase().includes(keyword));
  }, [searchValue, sessions]);

  // Handle Popover state change
  const handlePopoverHandler = (openState: boolean) => {
    if (openState && !isOpen) {
      onToggle();
    } else if (!openState && isOpen) {
      onClose();
    }
  };

  function startEditing(session: SessionSummary) {
    setEditingSessionId(session.id);
    setEditingTitle(session.title);
  }

  async function handleSaveEdit() {
    if (!editingSessionId || !onUpdate || isUpdating) return;
    setIsUpdating(true);
    try {
      const success = await onUpdate(editingSessionId, editingTitle);
      if (success) {
        setEditingSessionId(null);
        setEditingTitle('');
      }
    } finally {
      setIsUpdating(false);
    }
  }

  async function handleDeleteSession(sessionId: number, _sessionTitle: string) {
    if (!onDelete || isDeleting) return;
    setIsDeleting(true);
    try {
      await onDelete(sessionId);
      if (editingSessionId === sessionId) {
        setEditingSessionId(null);
        setEditingTitle('');
      }
    } finally {
      setIsDeleting(false);
    }
  }

  useEffect(() => {
    if (editingSessionId && editInputRef.current) {
      editInputRef.current.focus();
      // editInputRef.current.select(); // HTMLInputElement select
    }
  }, [editingSessionId]);

  useEffect(() => {
    if (!isOpen) return;
    searchInputRef.current?.focus();
  }, [isOpen, searchInputRef]);

  useEffect(() => {
    if (isOpen) return;
    setSearchValue('');
    setEditingSessionId(null);
    setEditingTitle('');
  }, [isOpen]);

  return (
    <div className="flex items-center border border-gray-300 rounded-lg bg-white overflow-hidden h-8">
      <Popover open={isOpen} handler={handlePopoverHandler} placement="bottom-start" offset={4}>
        <PopoverHandler>
          <button className="flex items-center gap-2 px-3 py-1 h-full hover:bg-gray-100 transition-colors text-left min-w-[120px] max-w-[200px]">
            <Typography variant="small" className="font-medium text-gray-600 text-[11px]">
              会话
            </Typography>
            <Typography
              variant="small"
              className="font-semibold text-gray-900 text-xs truncate max-w-[100px]"
            >
              {activeSession?.title ?? '未命名'}
            </Typography>
            <ExpandMoreIcon
              className={`w-4 h-4 text-gray-500 transition-transform ${isOpen ? 'rotate-180' : ''}`}
            />
          </button>
        </PopoverHandler>
        <PopoverContent
          className="w-[340px] max-h-[420px] p-0 overflow-hidden"
          style={{ zIndex: LAYER_LEVELS.popover }}
        >
          <div className="p-3 border-b border-gray-200">
            <div className="relative w-full">
              <div className="absolute top-2/4 left-3 -translate-y-2/4 text-gray-500">
                <SearchIcon style={{ fontSize: 16 }} />
              </div>
              <input
                ref={searchInputRef}
                className="w-full h-8 pl-9 pr-3 rounded-lg bg-gray-100 border border-gray-300 text-xs text-gray-900 focus:outline-none focus:border-gray-500 focus:ring-0"
                placeholder="搜索会话"
                value={searchValue}
                onChange={(e) => setSearchValue(e.target.value)}
                id="session-search-input"
                name="sessionSearch"
                aria-label="搜索会话"
              />
            </div>
            {/* Error State */}
            {error && (
              <div className="flex items-center gap-2 mt-2">
                <Typography variant="small" color="red" className="text-[11px]">
                  {error}
                </Typography>
                <button
                  onClick={() => onRetry && onRetry()}
                  className="text-[11px] text-gray-800 underline"
                >
                  重试
                </button>
              </div>
            )}
          </div>

          <div className="max-h-[260px] overflow-y-auto p-2 flex flex-col gap-1">
            {isLoading ? (
              <div className="flex justify-center py-4">
                <Spinner className="h-5 w-5" />
              </div>
            ) : filteredSessions.length === 0 ? (
              <div className="py-4 text-center text-xs text-gray-600">
                {searchValue ? '未找到匹配会话' : '暂无会话记录'}
              </div>
            ) : (
              filteredSessions.map((item) => (
                <div
                  key={item.id}
                  className={`group relative rounded-lg transition-colors ${
                    item.id === activeSessionId ? 'bg-gray-200' : 'hover:bg-gray-100'
                  }`}
                >
                  {editingSessionId === item.id ? (
                    <div className="flex items-center gap-1 p-1 pr-2">
                      <input
                        ref={editInputRef}
                        className="flex-1 h-7 px-2 text-sm rounded border border-gray-400 focus:border-blue-500 focus:outline-none"
                        value={editingTitle}
                        onChange={(e) => setEditingTitle(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            void handleSaveEdit();
                          } else if (e.key === 'Escape') {
                            setEditingSessionId(null);
                            setEditingTitle('');
                          }
                        }}
                        disabled={isUpdating}
                        name="sessionTitle"
                        aria-label="编辑会话标题"
                      />
                      <IconButton
                        size="sm"
                        variant="text"
                        className="w-6 h-6 min-w-[24px] rounded text-blue-500 hover:bg-blue-50"
                        onClick={handleSaveEdit}
                        disabled={isUpdating}
                      >
                        {isUpdating ? (
                          <Spinner className="h-3 w-3" />
                        ) : (
                          <CheckIcon style={{ fontSize: 16 }} />
                        )}
                      </IconButton>
                      <IconButton
                        size="sm"
                        variant="text"
                        className="w-6 h-6 min-w-[24px] rounded text-gray-600 hover:bg-gray-200"
                        onClick={() => {
                          setEditingSessionId(null);
                          setEditingTitle('');
                        }}
                      >
                        <CloseIcon style={{ fontSize: 16 }} />
                      </IconButton>
                    </div>
                  ) : (
                    <>
                      <button
                        className="w-full text-left p-2 pr-16"
                        onClick={() => {
                          onSelect(item.id);
                          onClose();
                        }}
                      >
                        <Typography
                          variant="small"
                          className={`text-xs truncate ${item.id === activeSessionId ? 'font-semibold text-gray-900' : 'font-medium text-gray-800'}`}
                        >
                          {item.title}
                        </Typography>
                        <Typography
                          variant="small"
                          className="text-[10px] text-gray-500 font-medium mt-0.5"
                        >
                          {item.updatedAt}
                        </Typography>
                      </button>

                      <div className="absolute right-1 top-1/2 -translate-y-1/2 flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity bg-inherit">
                        {onUpdate && isConnected && (
                          <IconButton
                            size="sm"
                            variant="text"
                            className="w-6 h-6 min-w-[24px] rounded hover:bg-gray-300 text-gray-600"
                            onClick={(e) => {
                              e.stopPropagation();
                              startEditing(item);
                            }}
                          >
                            <EditIcon style={{ fontSize: 14 }} />
                          </IconButton>
                        )}
                        {onDelete && isConnected && (
                          <ConfirmPopover
                            message={`确定要删除会话「${item.title}」吗？`}
                            onConfirm={() => void handleDeleteSession(item.id, item.title)}
                            placement="left"
                            disabled={isDeleting}
                          >
                            <IconButton
                              size="sm"
                              variant="text"
                              className="w-6 h-6 min-w-[24px] rounded hover:bg-red-50 text-gray-500 hover:text-red-600"
                              onClick={(e) => {
                                e.stopPropagation();
                              }}
                              disabled={isDeleting}
                            >
                              <DeleteIcon style={{ fontSize: 14 }} />
                            </IconButton>
                          </ConfirmPopover>
                        )}
                      </div>
                    </>
                  )}
                </div>
              ))
            )}
          </div>
        </PopoverContent>
      </Popover>

      <div className="h-4 w-px bg-gray-300" />

      <IconButton
        variant="text"
        size="sm"
        className="rounded-none h-full w-8 hover:bg-gray-100"
        onClick={async () => {
          await onCreate();
          onClose(); // Close popover if open
        }}
        disabled={!isConnected}
      >
        <AddIcon style={{ fontSize: 18 }} />
      </IconButton>
    </div>
  );
}
